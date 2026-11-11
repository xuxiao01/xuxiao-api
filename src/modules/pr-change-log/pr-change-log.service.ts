import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient, PrChangeLog } from '../../generated/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/app-error';
import { cursorSchema, type IngestInput, type ListQuery } from './pr-change-log.schema';
import { fileDto, listSelect, recordDto } from './pr-change-log.mapper';

export function normalizeContent(input: IngestInput) {
  const { sourceRunNumber: _number, sourceRunAttempt: _attempt, ...content } = input;
  return { ...content, files: [...content.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}

export function contentHash(input: IngestInput): string {
  return createHash('sha256').update(JSON.stringify(normalizeContent(input))).digest('hex');
}

export async function ingest(input: IngestInput, db: PrismaClient = prisma) {
  const hash = contentHash(input);
  const run = BigInt(input.sourceRunNumber);
  return db.$transaction(async (tx) => {
    // Also serializes simultaneous first inserts, when no PR row exists yet.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`${input.repository}:${input.number}`}, 0))`;
    const existing = await tx.prChangeLog.findUnique({
      where: { repository_prNumber: { repository: input.repository, prNumber: input.number } },
    });
    if (existing) {
      const older = run < existing.sourceRunNumber || (run === existing.sourceRunNumber && input.sourceRunAttempt < existing.sourceRunAttempt);
      if (older) return { id: existing.id, status: 'ignored_stale' };
      if (run === existing.sourceRunNumber && input.sourceRunAttempt === existing.sourceRunAttempt) {
        if (hash !== existing.contentHash) throw new AppError(409, '同一上报版本的内容不一致');
        return { id: existing.id, status: 'unchanged' };
      }
      if (hash === existing.contentHash) {
        await tx.prChangeLog.update({ where: { id: existing.id }, data: {
          sourceRunNumber: run, sourceRunAttempt: input.sourceRunAttempt,
        } });
        return { id: existing.id, status: 'unchanged' };
      }
    }
    const data = {
      repository: input.repository, prNumber: input.number, title: input.title,
      author: input.author, url: input.url, prCreatedAt: new Date(input.createdAt),
      headSha: input.headSha, fileCount: input.fileCount, filesComplete: input.filesComplete,
      contentHash: hash, sourceRunNumber: run, sourceRunAttempt: input.sourceRunAttempt,
      changeType: 'unknown', changeSummary: null, analysisStatus: 'pending',
      analysisPartial: false, analysisAttempts: 0,
    };
    const record = existing
      ? await tx.prChangeLog.update({ where: { id: existing.id }, data })
      : await tx.prChangeLog.create({ data });
    await tx.prChangeLogFile.deleteMany({ where: { prId: record.id } });
    if (input.files.length) {
      await tx.prChangeLogFile.createMany({ data: input.files.map((file) => ({ ...file, prId: record.id })) });
    }
    return { id: record.id, status: existing ? 'updated' : 'created' };
  });
}

export function parseCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
    throw new AppError(400, '分页游标无效');
  }
}

export async function listRecords(query: ListQuery, db: PrismaClient = prisma) {
  const cursor = parseCursor(query.cursor);
  const filters: Prisma.PrChangeLogWhereInput[] = [];
  if (query.repository) filters.push({ repository: query.repository });
  if (query.changeType) filters.push({ changeType: query.changeType });
  if (query.q) {
    const number = /^\d+$/.test(query.q) && Number(query.q) <= 2147483647 ? Number(query.q) : null;
    filters.push({ OR: [
      ...['title', 'repository', 'author', 'headSha'].map((field) => ({ [field]: { contains: query.q, mode: 'insensitive' as const } })),
      ...(number === null ? [] : [{ prNumber: number }]),
    ] });
  }
  if (cursor) filters.push({ OR: [
    { prCreatedAt: { lt: new Date(cursor.date) } },
    { prCreatedAt: new Date(cursor.date), id: { lt: cursor.id } },
  ] });
  const rows = await db.prChangeLog.findMany({
    where: { AND: filters }, select: listSelect,
    orderBy: [{ prCreatedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(recordDto),
    nextCursor: rows.length > query.limit && last
      ? Buffer.from(JSON.stringify({ date: last.prCreatedAt.toISOString(), id: last.id })).toString('base64url') : null,
  };
}

export async function getRecord(id: string, db: PrismaClient = prisma) {
  const record = await db.$transaction((tx) => tx.prChangeLog.findUnique({
    where: { id }, select: { ...listSelect, files: { orderBy: { path: 'asc' } } },
  }), { isolationLevel: 'RepeatableRead' });
  if (!record) throw new AppError(404, 'PR 记录不存在');
  return { ...recordDto(record), files: record.files.map(fileDto) };
}

export async function reanalyze(id: string, db: PrismaClient = prisma) {
  const result = await db.prChangeLog.updateMany({
    where: { id, analysisStatus: { in: ['succeeded', 'failed'] } },
    data: { analysisStatus: 'pending', analysisAttempts: 0, changeType: 'unknown', changeSummary: null, analysisPartial: false },
  });
  if (!result.count) {
    if (!await db.prChangeLog.findUnique({ where: { id }, select: { id: true } })) throw new AppError(404, 'PR 记录不存在');
    throw new AppError(409, '该记录已在分析队列中');
  }
  return { id, analysisStatus: 'pending' };
}

export const ANALYSIS_LEASE_MS = 180_000;

export async function claimAnalysis(db: PrismaClient = prisma, now = new Date()) {
  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM pr_change_logs
      WHERE analysis_status = 'pending'
         OR (analysis_status = 'processing' AND analysis_started_at < ${new Date(now.getTime() - ANALYSIS_LEASE_MS)})
      ORDER BY updated_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!candidates.length) return null;
    const current = await tx.prChangeLog.findUniqueOrThrow({ where: { id: candidates[0]!.id } });
    if (current.analysisAttempts >= 2) {
      await tx.prChangeLog.update({ where: { id: current.id }, data: { analysisStatus: 'failed' } });
      return { exhausted: true as const };
    }
    // This monotonic timestamp is the lease identity; never reset it on requeue.
    const startedAt = new Date(Math.max(now.getTime(), (current.analysisStartedAt?.getTime() ?? 0) + 1));
    const record = await tx.prChangeLog.update({
      where: { id: current.id },
      data: { analysisStatus: 'processing', analysisAttempts: { increment: 1 }, analysisStartedAt: startedAt },
      include: { files: { orderBy: { path: 'asc' } } },
    });
    return { exhausted: false as const, record };
  });
}

export function analysisGuard(record: PrChangeLog): Prisma.PrChangeLogWhereInput {
  return {
    id: record.id, contentHash: record.contentHash, analysisStatus: 'processing',
    analysisAttempts: record.analysisAttempts, analysisStartedAt: record.analysisStartedAt,
  };
}
