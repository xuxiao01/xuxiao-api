import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/client';
import type * as Service from '../src/modules/pr-change-log/pr-change-log.service';
import type { PrChangeLogConfig } from '../src/modules/pr-change-log/pr-change-log.config';

const databaseUrl = process.env.PR_CHANGE_LOG_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const load = createRequire(import.meta.url);
let db: PrismaClient;
let control: Client;
let server: Server;
let base: string;
let admin: string;
let visitor: string;
let config: PrChangeLogConfig;
let service: typeof Service;
const ingestToken = 'isolated-pr-change-log-test-token-only-32-characters';
const input = (number = 48, run = '1') => ({
  repository: 'owner/repo', number, title: `配置 ${number}`, author: 'developer',
  url: `https://github.com/owner/repo/pull/${number}`, createdAt: '2026-11-11T00:00:00Z',
  headSha: 'a'.repeat(40), fileCount: 1, filesComplete: true,
  sourceRunNumber: run, sourceRunAttempt: 1,
  files: [{ path: 'web/editor.js', status: 'modified', additions: 1, deletions: 1,
    patch: '@@ -1 +1 @@\n-old\n+new', patchStatus: 'available' }],
});
const reviewed = () => ({ changeType: 'frontend', changeSummary: '简化编辑器', review: {
  status: 'succeeded', conclusion: 'no_concerns_found', headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40),
  runUrl: 'https://github.com/owner/repo/actions/runs/123', coverage: { status: 'full' }, findings: [],
} });

async function request(method: string, path: string, body?: unknown, token: string | null = admin) {
  const response = await fetch(base + (path.startsWith('/api/') ? path : '/api/pr-change-log' + path), {
    method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as any, headers: response.headers };
}
async function send(body: unknown = input()) {
  const response = await request('POST', '/ingest', body, ingestToken);
  expect(response.status).toBe(202);
  return response.body.data as { id: string; status: string };
}

suite('PR 记录：隔离 PostgreSQL 与真实 HTTP（AI 使用桩）', () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/pr_change_log_[a-z0-9_]+_test$/.test(url.pathname)) {
      throw new Error('只接受本机、pr_change_log_ 开头且 _test 结尾的独立空数据库');
    }
    control = new Client({ connectionString: databaseUrl });
    await control.connect();
    if ((await control.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rowCount) {
      throw new Error('测试库必须为空，不会修改已有表');
    }
    await control.query(readFileSync('prisma/migrations/20250622000000_init_user/migration.sql', 'utf8'));
    await control.query('ALTER TABLE "User" ADD COLUMN public_weekly_reports_enabled BOOLEAN NOT NULL DEFAULT false');
    await control.query(readFileSync('prisma/migrations/20261111000000_add_pr_change_log/migration.sql', 'utf8'));
    await control.query(readFileSync('prisma/migrations/20261111160000_add_pr_change_log_review/migration.sql', 'utf8'));
    vi.stubEnv('DATABASE_URL', databaseUrl!);
    vi.stubEnv('APP_MODULES', 'pr-change-log');
    vi.stubEnv('JWT_SECRET', 'isolated-pr-change-log-user-jwt-test');
    vi.stubEnv('PR_CHANGE_LOG_REPOSITORIES', 'owner/repo');
    vi.stubEnv('PR_CHANGE_LOG_INGEST_TOKEN', ingestToken);
    db = load('../dist/lib/prisma').prisma;
    service = load('../dist/modules/pr-change-log/pr-change-log.service');
    config = load('../dist/modules/pr-change-log/pr-change-log.config').prChangeLogConfig;
    const { hash } = await import('bcrypt');
    const passwordHash = await hash('test-password', 4);
    for (const id of [1, 2]) {
      await db.user.create({ data: { id, email: `${id}@example.test`, username: `user-${id}`, passwordHash } });
    }
    const { signToken } = load('../dist/modules/weekly-lab/auth/jwt');
    admin = signToken({ userId: 2, email: '2@example.test' });
    visitor = signToken({ userId: 1, email: '1@example.test' });
    server = createServer(load('../dist/app').default);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 20_000);

  beforeEach(async () => { await db.prChangeLog.deleteMany(); });
  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (db) await db.$disconnect();
    if (control) await control.end();
    vi.unstubAllEnvs();
  });

  it('复用登录，普通用户可读，未登录／删除账号拒绝，机器密钥不能查询', async () => {
    const login = await request('POST', '/api/auth/login', { email: '2@example.test', password: 'test-password' }, null);
    expect(login.status).toBe(200);
    expect((await request('GET', '/me', undefined, login.body.data.token)).body.data).toEqual({ userId: 2, canRead: true });
    for (const [token, status] of [[null, 401], [visitor, 200], [ingestToken, 401]] as const) {
      expect((await request('GET', '/records', undefined, token)).status).toBe(status);
    }
    const { signToken } = load('../dist/modules/weekly-lab/auth/jwt');
    expect((await request('GET', '/records', undefined, signToken({ userId: 9999 }))).status).toBe(401);
    const { sign } = load('jsonwebtoken');
    for (const claims of [{ userId: 2, purpose: 'mianjing', role: 'guest' }, { userId: 2, exp: 1 }]) {
      expect((await request('GET', '/me', undefined, sign(claims, process.env.JWT_SECRET))).status).toBe(401);
    }

  });

  it('机器入口拒绝用户 JWT、未知仓库、缺失配置和坏参数', async () => {
    expect((await request('POST', '/ingest', input(), admin)).status).toBe(401);
    expect((await request('POST', '/ingest', input(), null)).status).toBe(401);
    expect((await request('POST', '/ingest', { ...input(), repository: 'other/repo', url: 'https://github.com/other/repo/pull/48' }, ingestToken)).status).toBe(403);
    expect((await request('POST', '/ingest', { ...input(), fileCount: 2 }, ingestToken)).status).toBe(400);
    const previous = config.PR_CHANGE_LOG_INGEST_TOKEN;
    config.PR_CHANGE_LOG_INGEST_TOKEN = '';
    try { expect((await request('POST', '/ingest', input(), ingestToken)).status).toBe(503); }
    finally { config.PR_CHANGE_LOG_INGEST_TOKEN = previous; }
    expect(await db.prChangeLog.count()).toBe(0);
  });

  it('限定请求大小并返回统一错误，坏 JSON 不写库', async () => {
    const oversized = await request('POST', '/ingest', { large: 'x'.repeat(8 * 1024 * 1024) }, ingestToken);
    expect(oversized.status).toBe(413);
    expect(oversized.body.success).toBe(false);
    const malformed = await fetch(base + '/api/pr-change-log/ingest', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ingestToken}` }, body: '{invalid',
    });
    expect(malformed.status).toBe(400);
    expect(await db.prChangeLog.count()).toBe(0);
  });

  it('重复上报不新增，旧版本忽略，同一版本内容冲突拒绝', async () => {
    const first = await send(input(48, '10'));
    expect(first.status).toBe('created');
    expect(await send(input(48, '10'))).toEqual({ id: first.id, status: 'unchanged' });
    expect((await send({ ...input(48, '9'), title: '旧内容' })).status).toBe('ignored_stale');
    expect((await request('POST', '/ingest', { ...input(48, '10'), title: '不同内容' }, ingestToken)).status).toBe(409);
    expect(await db.prChangeLog.count()).toBe(1);
    expect(await db.prChangeLogFile.count()).toBe(1);
    const detail = await request('GET', `/records/${first.id}`);
    expect(detail.headers.get('cache-control')).toBe('no-store');
    expect(detail.body.data.files[0].patch).toContain('+new');
    expect(detail.body.data).not.toHaveProperty('contentHash');
  });

  it('兼容旧版内容哈希，重复旧上报不误报冲突', async () => {
    const { id } = await send();
    const normalized = load('../dist/modules/pr-change-log/pr-change-log.schema').ingestSchema.parse(input());
    const content = service.normalizeContent(normalized);
    const { review: _review, changeType: _type, changeSummary: _summary, ...legacy } = content;
    await db.prChangeLog.update({ where: { id }, data: { contentHash: createHash('sha256').update(JSON.stringify(legacy)).digest('hex') } });
    expect((await send()).status).toBe('unchanged');
    expect((await send(input(48, '2'))).status).toBe('unchanged');
    expect((await request('POST', '/ingest', { ...input(48, '2'), title: '仍不能改内容' }, ingestToken)).status).toBe(409);
  });

  it('并发首次上报最终保留最新运行，同一次运行按 attempt 更新', async () => {
    await Promise.all([send(input(48, '100')), send({ ...input(48, '101'), title: '新版' })]);
    let record = await db.prChangeLog.findFirstOrThrow();
    expect(record.title).toBe('新版');
    await send({ ...input(48, '101'), title: '再次执行', sourceRunAttempt: 2 });
    await send({ ...input(48, '101'), title: '晚到的 attempt', sourceRunAttempt: 1 });
    record = await db.prChangeLog.findFirstOrThrow();
    expect(record.title).toBe('再次执行');
    expect(record.sourceRunAttempt).toBe(2);
  });

  it('更新原 PR 并完整替换文件，清除旧分析结果', async () => {
    const first = await send();
    await send({ ...input(48, '2'), ...reviewed() });
    const changed = input(48, '3'); changed.headSha = 'b'.repeat(40); changed.files[0]!.path = 'new.ts';
    expect((await send(changed)).id).toBe(first.id);
    const detail = (await request('GET', `/records/${first.id}`)).body.data;
    expect(detail.files.map((file: any) => file.path)).toEqual(['new.ts']);
    expect(detail.changeType).toBe('unknown');
    expect(detail.changeSummary).toBeNull();
    expect(detail.review).toBeNull();
  });

  it('文件写入失败时 PR 和旧文件一起回滚', async () => {
    const first = await send();
    await control.query(`CREATE FUNCTION pr_change_log_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER pr_change_log_test_fail BEFORE INSERT ON pr_change_log_files FOR EACH ROW EXECUTE FUNCTION pr_change_log_test_fail()`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect((await request('POST', '/ingest', { ...input(48, '2'), title: '不能保存' }, ingestToken)).status).toBe(500);
      const record = await db.prChangeLog.findUniqueOrThrow({ where: { id: first.id }, include: { files: true } });
      expect(record.title).toBe('配置 48');
      expect(record.sourceRunNumber).toBe(1n);
      expect(record.files).toHaveLength(1);
    } finally {
      log.mockRestore();
      await control.query('DROP TRIGGER pr_change_log_test_fail ON pr_change_log_files; DROP FUNCTION pr_change_log_test_fail()');
    }
  });

  it('按 PR 创建时间分页，搜索与筛选作用于全库，列表无 diff', async () => {
    for (const number of [1, 2, 3, 4]) await send({ ...input(number), createdAt: number === 1 ? '2020-01-01T00:00:00Z' : '2026-01-01T00:00:00Z', title: number === 1 ? 'needle' : '普通记录' });
    const first = (await request('GET', '/records?limit=2')).body.data;
    const second = (await request('GET', `/records?limit=2&cursor=${first.nextCursor}`)).body.data;
    expect(new Set([...first.items, ...second.items].map((row: any) => row.id)).size).toBe(4);
    expect(second.items.at(-1).number).toBe(1);
    expect(first.items[0]).not.toHaveProperty('files');
    expect((await request('GET', '/records?q=needle')).body.data.items[0].number).toBe(1);
    expect((await request('GET', '/records?changeType=backend')).body.data.items).toEqual([]);
    expect((await request('GET', '/records?cursor=bad')).status).toBe(400);
    expect((await request('GET', '/records?limit=101')).status).toBe(400);
    expect((await request('GET', `/records/${randomUUID()}`)).status).toBe(404);
  });

  it('截断、缺失、二进制及重命名字段在详情保持准确', async () => {
    const value = input();
    const files = [
      { ...value.files[0], path: 'a.js', status: 'renamed', previousPath: 'old.js', patchStatus: 'truncated' },
      { path: 'b.png', status: 'added', patchStatus: 'binary' },
      { path: 'c.txt', status: 'unknown', patchStatus: 'missing' },
    ];
    const { id } = await send({ ...value, files, fileCount: 4, filesComplete: false });
    const detail = (await request('GET', `/records/${id}`)).body.data;
    expect(detail.filesComplete).toBe(false);
    expect(detail.files[0]).toMatchObject({ previousPath: 'old.js', patchTruncated: true });
    expect(detail.files[1]).toMatchObject({ binary: true, patch: null, additions: null });
    expect(detail.files[2]).toMatchObject({ binary: false, patch: null });
  });

  it('存储本次审查，列表不读取大结果；旧接口已停用且不改变数据', async () => {
    const { id } = await send({ ...input(), ...reviewed() });
    const detail = (await request('GET', `/records/${id}`)).body.data;
    expect(detail).toMatchObject({ changeType: 'frontend', changeSummary: '简化编辑器', review: { status: 'succeeded' } });
    expect((await request('GET', '/records')).body.data.items[0]).not.toHaveProperty('review');
    const before = await db.prChangeLog.findUniqueOrThrow({ where: { id } });
    expect((await request('POST', `/records/${id}/reanalyze`, undefined, visitor)).status).toBe(410);
    expect(await db.prChangeLog.findUniqueOrThrow({ where: { id } })).toEqual(before);
  });
  it('失败与部分覆盖不丢代码，过期审查拒绝且不覆盖已保存结果', async () => {
    const { id } = await send({ ...input(), ...reviewed() });
    expect((await request('POST', '/ingest', { ...input(48, '2'), headSha: 'c'.repeat(40), ...reviewed() }, ingestToken)).status).toBe(400);
    await send({ ...input(48, '2'), review: { ...reviewed().review, status: 'failed', conclusion: 'unknown', coverage: { status: 'unknown' } } });
    const detail = (await request('GET', `/records/${id}`)).body.data;
    expect(detail.changeType).toBe('unknown');
    expect(detail.review.status).toBe('failed');
    expect(detail.files[0].patch).toContain('+new');
    await send({ ...input(48, '3'), ...reviewed(), review: { ...reviewed().review, coverage: { status: 'partial', skippedFiles: ['a.ts'] } } });
    expect((await request('GET', `/records/${id}`)).body.data.review.coverage.status).toBe('partial');
    const tables = (await control.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((row) => row.tablename);
    expect(tables).toEqual(['User', 'pr_change_log_files', 'pr_change_logs']);
  });
});
