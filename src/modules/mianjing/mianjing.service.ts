import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/client';
import type { MianjingCompany } from '../../generated/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/app-error';
import {
  categoryValues,
  companyDto,
  masteryValues,
  occurrenceDto,
  priorityValues,
  questionDto,
  recruitmentValues,
  roundValues,
  safeCount,
} from './mianjing.mapper';
import type {
  CatalogInput,
  CreateOccurrenceInput,
  CreateQuestionInput,
  ListQuery,
  UpdateMetaInput,
  UpdateQuestionInput,
} from './mianjing.schema';

type Transaction = Prisma.TransactionClient;

// One admin and three tables: coordinate mutations without a settings/lock table.
// Namespace is local to mianjing; other products never acquire this lock.
function write<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(19786, 1)::text AS locked`;
      return callback(tx);
    },
    { maxWait: 10000, timeout: 15000 },
  );
}

async function requireQuestion(tx: Transaction, id: string) {
  const question = await tx.mianjingQuestion.findUnique({ where: { id } });
  if (!question) throw new AppError(404, '题目不存在');
  return question;
}

async function companyMap(tx: Transaction) {
  const companies = await tx.mianjingCompany.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return new Map(companies.map((company) => [company.id, company]));
}

async function requireEnabledCompany(tx: Transaction, id: string) {
  const company = await tx.mianjingCompany.findUnique({ where: { id } });
  if (!company || !company.enabled) throw new AppError(400, '请选择已启用的公司');
  return company;
}

async function readQuestion(tx: Transaction, id: string) {
  const question = await requireQuestion(tx, id);
  const count = await tx.mianjingOccurrence.count({
    where: { questionId: id },
  });
  return questionDto(question, BigInt(count), await companyMap(tx));
}

export async function getCatalog() {
  const items = await prisma.mianjingCompany.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return { items: items.map(companyDto) };
}

export async function saveCatalog(input: CatalogInput) {
  return write(async (tx) => {
    const old = await tx.mianjingCompany.findMany();
    const desiredIds = new Set(input.items.map((item) => item.id));
    if (old.some((item) => !desiredIds.has(item.id))) {
      throw new AppError(400, '公司不能删除，请保留并设为停用');
    }
    const desiredNames = new Set(input.items.map((item) => item.name));
    const usedNames = new Set([...old.map((item) => item.name), ...desiredNames]);
    // Allow two companies to exchange names without violating the unique index mid-save.
    for (const previous of old) {
      if (input.items.find((item) => item.id === previous.id)!.name !== previous.name) {
        let temporary: string;
        do {
          temporary = `mianjing-${randomUUID()}`;
        } while (usedNames.has(temporary));
        usedNames.add(temporary);
        await tx.mianjingCompany.update({
          where: { id: previous.id },
          data: { name: temporary },
        });
      }
    }
    const items: MianjingCompany[] = [];
    for (const [sortOrder, item] of input.items.entries()) {
      const data = {
        name: item.name,
        palette: item.palette,
        enabled: item.enabled,
        sortOrder,
      };
      items.push(
        await tx.mianjingCompany.upsert({
          where: { id: item.id },
          create: { id: item.id, ...data },
          update: data,
        }),
      );
    }
    return { items: items.map(companyDto) };
  });
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function listQuestions(query: ListQuery) {
  return prisma.$transaction(
    async (tx) => {
      const terms = query.search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const conditions: Prisma.Sql[] = [];
      if (query.category)
        conditions.push(Prisma.sql`q.category = ${query.category}::"MianjingCategory"`);
      if (query.mastery)
        conditions.push(Prisma.sql`q.mastery = ${query.mastery}::"MianjingMastery"`);
      if (query.company)
        conditions.push(Prisma.sql`q.company_ids @> ARRAY[${query.company}::uuid]`);
      if (query.organized !== undefined)
        conditions.push(Prisma.sql`q.organized = ${query.organized}`);
      for (const term of terms) {
        const pattern = `%${escapeLike(term)}%`;
        conditions.push(Prisma.sql`(
        q.title ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM unnest(q.tags) AS tag WHERE tag ILIKE ${pattern})
        OR EXISTS (SELECT 1 FROM mianjing_companies c
          WHERE c.id = ANY(q.company_ids) AND c.name ILIKE ${pattern})
        OR EXISTS (SELECT 1 FROM mianjing_occurrences o
          WHERE o.question_id = q.id AND o.content ILIKE ${pattern})
      )`);
      }
      const where = conditions.length
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;
      const [row] = await tx.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total FROM mianjing_questions q ${where}`;
      const total = safeCount(row.total);
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
      const titleHits = terms.length
        ? Prisma.sql`${Prisma.join(
            terms.map(
              (term) =>
                Prisma.sql`CASE WHEN q.title ILIKE ${`%${escapeLike(term)}%`} THEN 1 ELSE 0 END`,
            ),
            ' + ',
          )}`
        : Prisma.sql`0`;
      const priority = Prisma.sql`(
      CASE q.priority::text WHEN '高' THEN 3 WHEN '中' THEN 2 ELSE 1 END * 10
      + CASE q.mastery::text WHEN '不会' THEN 4 WHEN '模糊' THEN 3 WHEN '基本掌握' THEN 2 ELSE 1 END
    )`;
      const order =
        query.sort === 'count'
          ? Prisma.sql`total_count DESC, q.id ASC`
          : query.sort === 'updated'
            ? Prisma.sql`q.updated_at DESC, q.id ASC`
            : Prisma.sql`${priority} DESC, total_count DESC, q.id ASC`;
      const selected = await tx.$queryRaw<{ id: string; record_count: bigint }[]>`
      SELECT q.id, records.record_count, q.base_count + records.record_count AS total_count,
             (${titleHits}) AS title_hits
      FROM mianjing_questions q
      CROSS JOIN LATERAL (SELECT COUNT(*)::bigint AS record_count
        FROM mianjing_occurrences o WHERE o.question_id = q.id) records
      ${where}
      ORDER BY title_hits DESC, ${order}
      LIMIT ${query.pageSize} OFFSET ${(page - 1) * query.pageSize}`;
      const questions = await tx.mianjingQuestion.findMany({
        where: { id: { in: selected.map((item) => item.id) } },
      });
      const byId = new Map(questions.map((question) => [question.id, question]));
      const companies = await companyMap(tx);
      const used = await tx.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT unnest(company_ids) AS id FROM mianjing_questions ORDER BY id`;
      return {
        items: selected.map((item) =>
          questionDto(byId.get(item.id)!, item.record_count, companies),
        ),
        total,
        page,
        pageSize: query.pageSize,
        usedCompanyIds: used.map((item) => item.id),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    },
  );
}

export async function getQuestion(id: string) {
  return prisma.$transaction(
    async (tx) => {
      const question = await readQuestion(tx, id);
      const occurrences = await tx.mianjingOccurrence.findMany({
        where: { questionId: id },
        include: { company: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      });
      return { question, occurrences: occurrences.map(occurrenceDto) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function createQuestion(input: CreateQuestionInput) {
  return write(async (tx) => {
    if (input.source) await requireEnabledCompany(tx, input.source.companyId);
    const question = await tx.mianjingQuestion.create({
      data: {
        title: input.title,
        category: categoryValues[input.category],
        tags: input.tags,
        priority: priorityValues[input.priority],
        mastery: masteryValues[input.mastery],
        organized: input.organized,
        companyIds: input.source ? [input.source.companyId] : [],
      },
    });
    if (input.source) {
      await tx.mianjingOccurrence.create({
        data: {
          questionId: question.id,
          companyId: input.source.companyId,
          recruitmentType: recruitmentValues[input.source.recruitmentType],
          round: roundValues[input.source.round],
          content: '',
        },
      });
    }
    return readQuestion(tx, question.id);
  });
}

export async function updateQuestion(id: string, input: UpdateQuestionInput) {
  return write(async (tx) => {
    await requireQuestion(tx, id);
    await tx.mianjingQuestion.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.category !== undefined ? { category: categoryValues[input.category] } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.priority !== undefined ? { priority: priorityValues[input.priority] } : {}),
        ...(input.mastery !== undefined ? { mastery: masteryValues[input.mastery] } : {}),
        ...(input.organized !== undefined ? { organized: input.organized } : {}),
      },
    });
    return readQuestion(tx, id);
  });
}

export async function updateMeta(id: string, input: UpdateMetaInput) {
  return write(async (tx) => {
    const question = await requireQuestion(tx, id);
    if (input.companyIds !== undefined) {
      const companies = await companyMap(tx);
      for (const companyId of input.companyIds) {
        const company = companies.get(companyId);
        if (!company || (!company.enabled && !question.companyIds.includes(companyId))) {
          throw new AppError(400, '公司不存在或已停用，不能重新添加');
        }
      }
    }
    let baseCount: bigint | undefined;
    if (input.totalCount !== undefined) {
      const records = await tx.mianjingOccurrence.count({
        where: { questionId: id },
      });
      if (input.totalCount < records)
        throw new AppError(400, `已有 ${records} 条记录，总次数不能更小`);
      baseCount = BigInt(input.totalCount) - BigInt(records);
    }
    await tx.mianjingQuestion.update({
      where: { id },
      data: {
        ...(input.companyIds !== undefined ? { companyIds: input.companyIds } : {}),
        ...(input.mastery !== undefined ? { mastery: masteryValues[input.mastery] } : {}),
        ...(input.organized !== undefined ? { organized: input.organized } : {}),
        ...(baseCount !== undefined ? { baseCount } : {}),
      },
    });
    return readQuestion(tx, id);
  });
}

export async function createOccurrence(questionId: string, input: CreateOccurrenceInput) {
  return write(async (tx) => {
    const question = await requireQuestion(tx, questionId);
    await requireEnabledCompany(tx, input.companyId);
    const count = await tx.mianjingOccurrence.count({ where: { questionId } });
    safeCount(question.baseCount + BigInt(count) + 1n);
    const occurrence = await tx.mianjingOccurrence.create({
      data: { questionId, companyId: input.companyId, content: input.content },
      include: { company: true },
    });
    await tx.mianjingQuestion.update({
      where: { id: questionId },
      data: {
        companyIds: [...new Set([...question.companyIds, input.companyId])],
        updatedAt: new Date(),
      },
    });
    return occurrenceDto(occurrence);
  });
}

export async function updateOccurrence(id: string, content: string) {
  return write(async (tx) => {
    const previous = await tx.mianjingOccurrence.findUnique({ where: { id } });
    if (!previous) throw new AppError(404, '出现记录不存在');
    const occurrence = await tx.mianjingOccurrence.update({
      where: { id },
      data: { content },
      include: { company: true },
    });
    await tx.mianjingQuestion.update({
      where: { id: previous.questionId },
      data: { updatedAt: new Date() },
    });
    return occurrenceDto(occurrence);
  });
}

export async function deleteOccurrence(id: string) {
  return write(async (tx) => {
    const occurrence = await tx.mianjingOccurrence.findUnique({
      where: { id },
    });
    if (!occurrence) throw new AppError(404, '出现记录不存在');
    await tx.mianjingOccurrence.delete({ where: { id } });
    await tx.mianjingQuestion.update({
      where: { id: occurrence.questionId },
      data: { updatedAt: new Date() },
    });
    return { id };
  });
}

export async function deleteQuestion(id: string) {
  return write(async (tx) => {
    await requireQuestion(tx, id);
    await tx.mianjingQuestion.delete({ where: { id } });
    return { id };
  });
}
