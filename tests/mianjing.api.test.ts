import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/client';

const databaseUrl = process.env.MIANJING_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const loadBuilt = createRequire(import.meta.url);
let db: PrismaClient;
let control: Client;
let server: Server;
let origin: string;
let adminToken: string;
let visitorToken: string;
let guestToken: string;
let createdTables = false;
const companyA = randomUUID();
const companyB = randomUUID();
const catalog = () => ({
  items: [
    { id: companyA, name: '腾讯', palette: 'blue', enabled: true },
    { id: companyB, name: '百度', palette: 'white', enabled: true },
  ],
});

async function request(
  method: string,
  path: string,
  body?: unknown,
  token: string | null = adminToken,
) {
  const response = await fetch(
    origin + (path.startsWith('/api/') ? path : '/api/mianjing' + path),
    {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function addQuestion(input: Record<string, unknown> = {}) {
  const response = await request('POST', '/questions', {
    title: '并发请求调度器',
    category: '手撕',
    ...input,
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

suite('面经 API：独立空 PostgreSQL 测试库', () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
      throw new Error('MIANJING_TEST_DATABASE_URL 必须是本机独立、名称以 _test 结尾的空数据库');
    }
    control = new Client({ connectionString: databaseUrl });
    await control.connect();
    const tables = await control.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if (tables.rowCount) throw new Error('测试库 public 必须为空，不会覆盖已有表或数据');
    await control.query(`CREATE TABLE "User" (
      id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL, public_weekly_reports_enabled BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
    )`);
    createdTables = true;
    await control.query(
      readFileSync(resolve('prisma/migrations/20261102000000_add_mianjing/migration.sql'), 'utf8'),
    );
    vi.stubEnv('DATABASE_URL', databaseUrl!);
    vi.stubEnv('JWT_SECRET', 'mianjing-isolated-test-secret-only');
    vi.stubEnv('MIANJING_ADMIN_USER_ID', '2');
    vi.stubEnv('APP_MODULES', 'mianjing');
    vi.stubEnv('RELEASE_SHA', 'a'.repeat(40));
    vi.stubEnv('MIANJING_GUEST_JWT_SECRET', 'isolated-mianjing-guest-key-at-least-32-chars');
    // Exercise the built service, including its existing CommonJS module loader.
    db = loadBuilt('../dist/lib/prisma').prisma;
    const { hash } = await import('bcrypt');
    const passwordHash = await hash('test-password', 4);
    const admin = await db.user.create({
      data: {
        id: 2,
        email: 'admin@example.test',
        username: '管理员',
        passwordHash,
      },
    });
    const visitor = await db.user.create({
      data: {
        id: 1,
        email: 'visitor@example.test',
        username: '访客',
        passwordHash,
      },
    });
    const { signToken } = loadBuilt('../dist/modules/weekly-lab/auth/jwt');
    adminToken = signToken({ userId: admin.id, email: admin.email });
    visitorToken = signToken({ userId: visitor.id, email: visitor.email });
    const app = loadBuilt('../dist/app').default;
    server = createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    guestToken = (await request('POST', '/auth/guest', {}, null)).body.data.token;
  }, 20000);

  afterAll(async () => {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    if (db) await db.$disconnect();
    if (createdTables) {
      await control.query('ROLLBACK');
      await control.query(
        `DROP TABLE IF EXISTS mianjing_occurrences, mianjing_questions, mianjing_companies, "User" CASCADE`,
      );
      for (const name of [
        'MianjingCategory',
        'MianjingPriority',
        'MianjingMastery',
        'MianjingRecruitmentType',
        'MianjingRound',
        'MianjingPalette',
      ]) {
        await control.query(`DROP TYPE IF EXISTS "${name}" CASCADE`);
      }
    }
    if (control) await control.end();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await db.mianjingOccurrence.deleteMany();
    await db.mianjingQuestion.deleteMany();
    await db.mianjingCompany.deleteMany();
  });

  it('公开就绪检查包含版本，配置缺失时 503 且不泄漏信息', async () => {
    expect((await request('GET', '/health', undefined, null)).body.data).toEqual({
      status: 'ready',
      apiVersion: 1,
      commit: 'a'.repeat(40),
    });
    const config = loadBuilt('../dist/modules/mianjing/mianjing.config').mianjingConfig;
    const previous = config.MIANJING_GUEST_JWT_SECRET;
    try {
      config.MIANJING_GUEST_JWT_SECRET = '';
      const result = await request('GET', '/health', undefined, null);
      expect(result.status).toBe(503);
      expect(result.body).toEqual({ success: false, message: '面经服务未就绪' });
    } finally {
      config.MIANJING_GUEST_JWT_SECRET = previous;
    }
  });

  it('游客独立密钥、用途、时效及入口配置；拒绝跨产品调用', async () => {
    const jwt = loadBuilt('jsonwebtoken');
    const config = loadBuilt('../dist/modules/mianjing/mianjing.config').mianjingConfig;
    const key = config.MIANJING_GUEST_JWT_SECRET;
    const decoded = jwt.decode(guestToken);
    expect(decoded.exp - decoded.iat).toBe(3600);
    expect(decoded.aud).toBe('mianjing');
    expect((await request('GET', '/api/auth/me', undefined, guestToken)).status).toBe(401);
    for (const options of [
      { expiresIn: -1, audience: 'mianjing', issuer: 'mianjing' },
      { expiresIn: 3600, audience: 'weekly', issuer: 'mianjing' },
      { expiresIn: 3600, audience: 'mianjing', issuer: 'other' },
    ]) {
      const invalid = jwt.sign({ role: 'guest', purpose: 'mianjing' }, key, options);
      expect((await request('GET', '/me', undefined, invalid)).status).toBe(401);
    }
    try {
      for (const invalidKey of ['', 'short', 'mianjing-isolated-test-secret-only']) {
        config.MIANJING_GUEST_JWT_SECRET = invalidKey;
        expect((await request('POST', '/auth/guest', {}, null)).status).toBe(503);
      }
    } finally {
      config.MIANJING_GUEST_JWT_SECRET = key;
    }
    const wrong = await request(
      'POST',
      '/api/auth/login',
      { email: 'admin@example.test', password: 'incorrect' },
      null,
    );
    expect(wrong.status).toBe(401);
  });

  it('只有三张业务表；复用账号登录、管理员写、访客读', async () => {
    const rows = await control.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'mianjing_%' ORDER BY tablename",
    );
    expect(rows.rows.map((row) => row.tablename)).toEqual([
      'mianjing_companies',
      'mianjing_occurrences',
      'mianjing_questions',
    ]);
    expect((await request('GET', '/questions', undefined, null)).status).toBe(401);
    expect((await request('GET', '/questions', undefined, 'invalid')).status).toBe(401);
    expect((await request('GET', '/me')).body.data).toMatchObject({
      isAdmin: true,
      canEdit: true,
      user: { id: 2 },
    });
    expect((await request('GET', '/me', undefined, visitorToken)).status).toBe(403);
    expect((await request('GET', '/me', undefined, guestToken)).body.data).toEqual({
      role: 'guest',
      user: null,
      isAdmin: false,
      canEdit: false,
    });
    expect(
      (await request('GET', '/company-catalog', undefined, guestToken)).body.data.items,
    ).toEqual([]);
    const id = randomUUID();
    for (const [method, path] of [
      ['POST', '/questions'],
      ['PATCH', `/questions/${id}`],
      ['PATCH', `/questions/${id}/meta`],
      ['POST', `/questions/${id}/occurrences`],
      ['PATCH', `/occurrences/${id}`],
      ['PUT', '/company-catalog'],
      ['DELETE', `/questions/${id}`],
      ['DELETE', `/occurrences/${id}`],
    ]) {
      expect((await request(method, path, {}, visitorToken)).status).toBe(403);
      expect((await request(method, path, {}, guestToken)).status).toBe(403);
    }
    const login = await request(
      'POST',
      '/api/auth/login',
      { email: 'admin@example.test', password: 'test-password' },
      null,
    );
    expect(login.status).toBe(200);
    expect(typeof login.body.data.token).toBe('string');
    expect(
      (await request('GET', '/api/auth/me', undefined, login.body.data.token)).body.data.email,
    ).toBe('admin@example.test');
    expect((await request('GET', '/questions', undefined, guestToken)).body.data).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect((await request('GET', '/snapshot')).status).toBe(404);
    expect((await request('GET', '/trash')).status).toBe(404);
  });

  it('无来源只创建题目，完整来源才创建首条空内容记录', async () => {
    await request('PUT', '/company-catalog', catalog());
    const plain = await addQuestion({
      title: '  Promise.all  ',
      tags: ['Promise', ' Promise '],
    });
    expect(plain).toMatchObject({
      title: 'Promise.all',
      tags: ['Promise'],
      companyIds: [],
      totalCount: 0,
      baseCount: 0,
      recordCount: 0,
    });
    const sourced = await addQuestion({
      source: { companyId: companyA, recruitmentType: '暑期', round: '二面' },
    });
    expect(sourced).toMatchObject({
      companyIds: [companyA],
      recordCount: 1,
      totalCount: 1,
    });
    const detail = (await request('GET', `/questions/${sourced.id}`)).body.data;
    expect(detail.occurrences).toHaveLength(1);
    expect(detail.occurrences[0]).toMatchObject({
      companyId: companyA,
      content: '',
      recruitmentType: '暑期',
      round: '二面',
      company: { name: '腾讯', palette: 'blue' },
    });
    expect(sourced).not.toHaveProperty('notes');
    expect(sourced).not.toHaveProperty('version');
    for (const source of [
      { companyId: companyA },
      { companyId: randomUUID(), recruitmentType: '日常', round: '一面' },
    ]) {
      expect(
        (
          await request('POST', '/questions', {
            title: '失败',
            category: '八股',
            source,
          })
        ).status,
      ).toBe(400);
    }
    expect(await db.mianjingQuestion.count()).toBe(2);
  });

  it('标签数组、重复公司计次、编辑和直接删除各自独立', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion();
    const first = await request('POST', `/questions/${q.id}/occurrences`, {
      companyId: companyA,
      content: '  实际问法\n保留换行  ',
    });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      content: '实际问法\n保留换行',
      recruitmentType: null,
      round: null,
    });
    await request('POST', `/questions/${q.id}/occurrences`, {
      companyId: companyA,
      content: '同公司第二次',
    });
    expect(
      (await request('PATCH', `/questions/${q.id}/meta`, { totalCount: 8 })).body.data,
    ).toMatchObject({
      baseCount: 6,
      totalCount: 8,
      recordCount: 2,
      companyIds: [companyA],
    });
    const edited = await request('PATCH', `/occurrences/${first.body.data.id}`, {
      content: '更新后的变形题',
    });
    expect(edited.body.data.createdAt).toBe(first.body.data.createdAt);
    await request('POST', `/questions/${q.id}/occurrences`, {
      companyId: companyB,
      content: '另一家公司的问法',
    });
    const changed = await request('PATCH', `/questions/${q.id}/meta`, {
      companyIds: [companyB, companyB.toUpperCase()],
    });
    expect(changed.body.data).toMatchObject({
      companyIds: [companyB],
      totalCount: 9,
    });
    expect((await request('GET', '/questions?company=' + companyA)).body.data.total).toBe(0);
    const added = await request('POST', `/questions/${q.id}/occurrences`, {
      companyId: companyA,
      content: '再次补入标签',
    });
    expect((await request('DELETE', `/occurrences/${added.body.data.id}`)).body.data.id).toBe(
      added.body.data.id,
    );
    const detail = (await request('GET', `/questions/${q.id}`)).body.data;
    expect(detail.question).toMatchObject({
      companyIds: [companyB, companyA],
      totalCount: 9,
      baseCount: 6,
      recordCount: 3,
    });
    expect(
      detail.occurrences.some((o: { content: string }) => o.content === '更新后的变形题'),
    ).toBe(true);
    expect((await request('DELETE', `/questions/${q.id}`)).status).toBe(200);
    expect(await db.mianjingOccurrence.count()).toBe(0);
    expect(await db.mianjingCompany.count()).toBe(2);
    expect((await request('GET', `/questions/${q.id}`)).status).toBe(404);
    expect((await request('DELETE', `/questions/${q.id}`)).status).toBe(404);
  });

  it('并发追加不丢公司标签，次数按最新明细校验，可清空标签', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion();
    const responses = await Promise.all(
      [companyA, companyB, companyA].map((companyId) =>
        request('POST', `/questions/${q.id}/occurrences`, {
          companyId,
          content: '并发录入',
        }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    const detail = (await request('GET', `/questions/${q.id}`)).body.data;
    expect(detail.question.totalCount).toBe(3);
    expect(new Set(detail.question.companyIds)).toEqual(new Set([companyA, companyB]));
    expect((await request('PATCH', `/questions/${q.id}/meta`, { totalCount: 2 })).status).toBe(400);
    expect(
      (
        await request('PATCH', `/questions/${q.id}/meta`, {
          companyIds: [],
          mastery: '熟练',
          organized: true,
        })
      ).body.data,
    ).toMatchObject({
      companyIds: [],
      totalCount: 3,
      mastery: '熟练',
      organized: true,
    });
    expect(await db.mianjingOccurrence.count()).toBe(3);
  });

  it('公司改名换色排序同步，停用可保留不可重新添加，禁止配置删除', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion({
      source: { companyId: companyA, recruitmentType: '日常', round: '一面' },
    });
    const swapped = {
      items: [
        { id: companyB, name: '腾讯', palette: 'black', enabled: true },
        { id: companyA, name: '百度', palette: 'white', enabled: false },
      ],
    };
    expect((await request('PUT', '/company-catalog', swapped)).status).toBe(200);
    const detail = (await request('GET', `/questions/${q.id}`)).body.data;
    expect(detail.question.companies[0]).toMatchObject({
      id: companyA,
      name: '百度',
      enabled: false,
      sortOrder: 1,
    });
    expect(detail.occurrences[0].company).toMatchObject({
      id: companyA,
      name: '百度',
      palette: 'white',
    });
    expect(detail.question.totalCount).toBe(1);
    expect(
      (
        await request('PATCH', `/questions/${q.id}/meta`, {
          companyIds: [companyA],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request('POST', `/questions/${q.id}/occurrences`, {
          companyId: companyA,
          content: '不能新增停用公司',
        })
      ).status,
    ).toBe(400);
    await request('PATCH', `/questions/${q.id}/meta`, { companyIds: [] });
    expect(
      (
        await request('PATCH', `/questions/${q.id}/meta`, {
          companyIds: [companyA],
        })
      ).status,
    ).toBe(400);
    expect((await request('PUT', '/company-catalog', { items: [swapped.items[0]] })).status).toBe(
      400,
    );
    swapped.items[1].enabled = true;
    expect((await request('PUT', '/company-catalog', swapped)).status).toBe(200);
    expect(
      (
        await request('POST', `/questions/${q.id}/occurrences`, {
          companyId: companyA,
          content: '重新启用',
        })
      ).status,
    ).toBe(201);
  });

  it('服务端搜索支持多字段AND、大小写和字面特殊字符，标题命中优先', async () => {
    await request('PUT', '/company-catalog', catalog());
    const titleHit = await addQuestion({
      title: '实现并发请求',
      tags: ['Promise'],
      organized: true,
    });
    await request('POST', `/questions/${titleHit.id}/occurrences`, {
      companyId: companyA,
      content: '保持顺序',
    });
    const contentHit = await addQuestion({
      title: '请求调度',
      category: '八股',
    });
    await request('POST', `/questions/${contentHit.id}/occurrences`, {
      companyId: companyB,
      content: '并发变形',
    });
    await request('PATCH', `/questions/${contentHit.id}/meta`, {
      totalCount: 100,
    });
    const combined = (
      await request(
        'GET',
        '/questions?' +
          new URLSearchParams({
            search: '并发 PROMISE 腾讯 保持',
            category: '手撕',
            company: companyA,
            mastery: '模糊',
            organized: 'true',
            sort: 'count',
          }),
      )
    ).body.data;
    expect(combined.items.map((q: { id: string }) => q.id)).toEqual([titleHit.id]);
    expect(new Set(combined.usedCompanyIds)).toEqual(new Set([companyA, companyB]));
    const ranked = (
      await request('GET', '/questions?' + new URLSearchParams({ search: '并发', sort: 'count' }))
    ).body.data;
    expect(ranked.items.map((q: { id: string }) => q.id)).toEqual([titleHit.id, contentHit.id]);
    expect(ranked.items[1]).not.toHaveProperty('content');
    const special = await addQuestion({
      title: 'Promise.all a+b [x] 100% _ \\',
    });
    for (const search of ['Promise.all', 'a+b', '[x]', '100%', '_', '\\']) {
      const list = (await request('GET', '/questions?' + new URLSearchParams({ search }))).body
        .data;
      expect(list.items.map((q: { id: string }) => q.id)).toEqual([special.id]);
    }
    expect(
      (await request('GET', '/questions?' + new URLSearchParams({ search: "%' OR 1=1 --" }))).body
        .data.total,
    ).toBe(0);
    expect((await request('GET', '/questions?search=not-found&page=99')).body.data).toMatchObject({
      items: [],
      page: 1,
      total: 0,
    });
  });

  it('分页校正、每页数量、排序和独立状态修改', async () => {
    const ids: string[] = [];
    for (let n = 0; n < 21; n++) ids.push((await addQuestion({ title: `分页题目 ${n}` })).id);
    const finalPage = (
      await request(
        'GET',
        '/questions?search=' + encodeURIComponent('分页') + '&pageSize=10&page=99',
      )
    ).body.data;
    expect(finalPage).toMatchObject({ total: 21, page: 3, pageSize: 10 });
    expect(finalPage.items).toHaveLength(1);
    expect((await request('GET', '/questions?pageSize=50')).body.data.items).toHaveLength(21);
    await request('PATCH', `/questions/${ids[0]}`, {
      title: '分页已编辑',
      tags: ['新知识点'],
      priority: '高',
    });
    await request('PATCH', `/questions/${ids[0]}/meta`, {
      mastery: '熟练',
      organized: true,
    });
    expect((await request('GET', '/questions?sort=updated')).body.data.items[0].id).toBe(ids[0]);
    expect((await request('GET', `/questions/${ids[0]}`)).body.data.question).toMatchObject({
      title: '分页已编辑',
      tags: ['新知识点'],
      priority: '高',
      mastery: '熟练',
      organized: true,
      totalCount: 0,
    });
    for (const query of ['page=-1', 'pageSize=100', 'company=invalid', 'organized=yes']) {
      expect((await request('GET', '/questions?' + query)).status).toBe(400);
    }
  }, 20000);

  it('无效ID、非法计数、超大请求拒绝；模块支持超过默认100KB的有效内容', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion();
    expect((await request('GET', '/questions/not-uuid')).status).toBe(400);
    expect((await request('GET', '/questions/' + randomUUID())).status).toBe(404);
    expect(
      (
        await request('POST', `/questions/${randomUUID()}/occurrences`, {
          companyId: companyA,
          content: '内容',
        })
      ).status,
    ).toBe(404);
    for (const totalCount of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1]) {
      expect((await request('PATCH', `/questions/${q.id}/meta`, { totalCount })).status).toBe(400);
    }
    expect(
      (
        await request('POST', `/questions/${q.id}/occurrences`, {
          companyId: companyA,
          content: ' ',
        })
      ).status,
    ).toBe(400);
    const large = await request('POST', `/questions/${q.id}/occurrences`, {
      companyId: companyA,
      content: '中'.repeat(200000),
    });
    expect(large.status).toBe(201);
    expect(large.body.data.content).toHaveLength(200000);
    expect(
      (
        await request('POST', `/questions/${q.id}/occurrences`, {
          companyId: companyA,
          content: 'x'.repeat(2 * 1024 * 1024),
        })
      ).status,
    ).toBe(413);
    const malformed = await fetch(origin + '/api/mianjing/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    expect(malformed.status).toBe(400);
    expect(await db.mianjingOccurrence.count()).toBe(1);
  });

  it('次数上限拒绝新增，避免总次数溢出或留下部分数据', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion();
    expect(
      (
        await request('PATCH', `/questions/${q.id}/meta`, {
          totalCount: Number.MAX_SAFE_INTEGER,
        })
      ).body.data.totalCount,
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(
      (
        await request('POST', `/questions/${q.id}/occurrences`, {
          companyId: companyA,
          content: '溢出',
        })
      ).status,
    ).toBe(409);
    expect(await db.mianjingOccurrence.count()).toBe(0);
    expect((await request('GET', `/questions/${q.id}`)).body.data.question.companyIds).toEqual([]);
  });

  it('真实数据库写入失败回滚题目、明细和标签', async () => {
    await request('PUT', '/company-catalog', catalog());
    const q = await addQuestion();
    const before = await db.mianjingQuestion.findUniqueOrThrow({
      where: { id: q.id },
    });
    await control.query(`CREATE FUNCTION mianjing_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated write failure'; END; $$;
      CREATE TRIGGER mianjing_test_fail BEFORE INSERT ON mianjing_occurrences FOR EACH ROW EXECUTE FUNCTION mianjing_test_fail();`);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(
        (
          await request('POST', '/questions', {
            title: '应整体回滚',
            category: '八股',
            source: {
              companyId: companyA,
              recruitmentType: '秋招',
              round: '三面',
            },
          })
        ).status,
      ).toBe(500);
      expect(
        (
          await request('POST', `/questions/${q.id}/occurrences`, {
            companyId: companyA,
            content: '应整体回滚',
          })
        ).status,
      ).toBe(500);
      expect(await db.mianjingQuestion.count()).toBe(1);
      expect(await db.mianjingOccurrence.count()).toBe(0);
      expect(await db.mianjingQuestion.findUnique({ where: { id: q.id } })).toEqual(before);
    } finally {
      errorLog.mockRestore();
      await control.query(
        'DROP TRIGGER mianjing_test_fail ON mianjing_occurrences; DROP FUNCTION mianjing_test_fail()',
      );
    }
  });

  it('公司配置中途失败不留下临时名称或部分排序配色', async () => {
    await request('PUT', '/company-catalog', catalog());
    const before = (await request('GET', '/company-catalog')).body.data;
    await control.query(`CREATE FUNCTION mianjing_test_catalog_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.name = '模拟失败' THEN RAISE EXCEPTION 'simulated catalog failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER mianjing_test_catalog_fail BEFORE UPDATE ON mianjing_companies FOR EACH ROW EXECUTE FUNCTION mianjing_test_catalog_fail();`);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const changed = catalog();
      changed.items[0] = {
        ...changed.items[0],
        name: '先更新的公司',
        palette: 'black',
      };
      changed.items[1] = { ...changed.items[1], name: '模拟失败' };
      expect((await request('PUT', '/company-catalog', changed)).status).toBe(500);
      expect((await request('GET', '/company-catalog')).body.data).toEqual(before);
    } finally {
      errorLog.mockRestore();
      await control.query(
        'DROP TRIGGER mianjing_test_catalog_fail ON mianjing_companies; DROP FUNCTION mianjing_test_catalog_fail()',
      );
    }
  });

  it('管理员未配置时禁止账号访问，已删除账号的 JWT 无法访问', async () => {
    const config = loadBuilt('../dist/modules/mianjing/mianjing.config').mianjingConfig;
    const previous = config.MIANJING_ADMIN_USER_ID;
    try {
      config.MIANJING_ADMIN_USER_ID = undefined;
      expect((await request('GET', '/me')).status).toBe(403);
      expect(
        (
          await request('POST', '/questions', {
            title: '不能写',
            category: '八股',
          })
        ).status,
      ).toBe(403);
    } finally {
      config.MIANJING_ADMIN_USER_ID = previous;
    }
    const { signToken } = loadBuilt('../dist/modules/weekly-lab/auth/jwt');
    const missingToken = signToken({
      userId: 999999,
      email: 'deleted@example.test',
    });
    expect((await request('GET', '/questions', undefined, missingToken)).status).toBe(401);
    expect(await db.mianjingQuestion.count()).toBe(0);
  });
});
