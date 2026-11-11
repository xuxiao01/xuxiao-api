import { describe, expect, it, vi } from 'vitest';
import type { PrChangeLogConfig } from './pr-change-log.config';
import type { AnalysisRecord } from './pr-change-log.ai';

vi.mock('../../lib/prisma', () => ({ prisma: {} }));

import { aiEndpoint, analyzeWithAI, AnalysisError, AI_INPUT_MAX_CHARS, buildAnalysisInput } from './pr-change-log.ai';
import { prChangeLogConfigSchema, allowedRepositories } from './pr-change-log.config';
import { contentHash, parseCursor } from './pr-change-log.service';
import { ingestSchema, listQuerySchema } from './pr-change-log.schema';

const raw = () => ({
  repository: 'Owner/Repo', number: 48, title: '编辑器', author: 'developer',
  url: 'https://github.com/owner/repo/pull/48', createdAt: '2026-11-11T08:00:00+08:00',
  headSha: 'a'.repeat(40), fileCount: 1, filesComplete: true,
  sourceRunNumber: '1', sourceRunAttempt: 1,
  files: [{ path: 'web/editor.js', status: 'modified', additions: 1, deletions: 1,
    patch: '@@ -1 +1 @@\n-old\n+new', patchStatus: 'available' }],
});
const config: PrChangeLogConfig = {
  PR_CHANGE_LOG_REPOSITORIES: ' Owner/Repo,owner/second ',
  PR_CHANGE_LOG_AI_API_BASE: 'https://provider.example/v1',
  PR_CHANGE_LOG_AI_API_KEY: 'isolated-unit-test-key', PR_CHANGE_LOG_AI_MODEL: 'test-model',
};
const record = (): AnalysisRecord => ({
  ...ingestSchema.parse(raw()), id: 'id', prNumber: 48, prCreatedAt: new Date(),
  files: ingestSchema.parse(raw()).files.map((file) => ({ ...file, id: 'file-id', prId: 'id' })),
} as unknown as AnalysisRecord);
const reply = (content: string, finish = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] }));

describe('PR 记录参数与兼容约定', () => {
  it('统一仓库大小写、时间和空值，运行编号保持字符串', () => {
    const value = ingestSchema.parse(raw());
    expect(value.repository).toBe('owner/repo');
    expect(value.createdAt).toBe('2026-11-11T00:00:00.000Z');
    expect(value.files[0]!.previousPath).toBeNull();
    expect(value.sourceRunNumber).toBe('1');
    expect(listQuerySchema.parse({}).limit).toBe(50);
  });

  it.each([
    { fileCount: 2 }, { filesComplete: false, fileCount: 0 },
    { sourceRunNumber: '9223372036854775808' }, { sourceRunAttempt: 0 },
    { createdAt: '2026-11-11T08:00:00' }, { changeType: 'frontend' },
    { url: 'https://github.com/other/repo/pull/48' },
    { url: 'https://user:secret@github.com/owner/repo/pull/48' },
  ])('拒绝错误或额外上报字段：%j', (patch) => {
    expect(ingestSchema.safeParse({ ...raw(), ...patch }).success).toBe(false);
  });

  it('拒绝重复文件、假二进制文本和缺失原路径的重命名', () => {
    const input = raw();
    expect(ingestSchema.safeParse({ ...input, fileCount: 2, files: [...input.files, ...input.files] }).success).toBe(false);
    for (const patch of [{ patchStatus: 'binary' }, { patch: null }, { status: 'renamed' }]) {
      expect(ingestSchema.safeParse({ ...input, files: [{ ...input.files[0], ...patch }] }).success).toBe(false);
    }
  });

  it('缺失差异与二进制分别表示，重命名完整保留', () => {
    const input = raw();
    for (const patchStatus of ['missing', 'binary']) {
      expect(ingestSchema.parse({ ...input, files: [{ ...input.files[0], patchStatus, patch: null }] }).files[0]!.patchStatus).toBe(patchStatus);
    }
    expect(ingestSchema.parse({ ...input, files: [{ ...input.files[0], status: 'renamed', previousPath: 'old.js' }] }).files[0]!.previousPath).toBe('old.js');
    // PostgreSQL's indexed path is bounded by UTF-8 bytes, not JS character count.
    expect(ingestSchema.safeParse({ ...input, files: [{ ...input.files[0], path: '长'.repeat(400) }] }).success).toBe(false);
  });

  it('摘要忽略文件顺序和运行编号，但保留代码差异', () => {
    const input = ingestSchema.parse({ ...raw(), fileCount: 2, files: [...raw().files, { ...raw().files[0], path: 'server.ts' }] });
    expect(contentHash(input)).toBe(contentHash({ ...input, sourceRunNumber: '100', files: [...input.files].reverse() }));
    expect(contentHash(input)).not.toBe(contentHash({ ...input, title: '新标题' }));
  });

  it('未配置不指定管理员，游标与分页参数严格校验', () => {
    expect(prChangeLogConfigSchema.parse({}).PR_CHANGE_LOG_ADMIN_USER_ID).toBeUndefined();
    expect(allowedRepositories(config)).toEqual(['owner/repo', 'owner/second']);
    expect(() => parseCursor('not-json')).toThrow('分页游标无效');
    expect(listQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('AI 分类：隔离调用与覆盖范围', () => {
  it('完整小差异标为完整，截断、缺失、二进制和不完整列表均标为部分', () => {
    expect(buildAnalysisInput(record()).partial).toBe(false);
    for (const status of ['truncated', 'missing', 'binary']) {
      const value = record(); value.files[0]!.patchStatus = status;
      expect(buildAnalysisInput(value).partial).toBe(true);
    }
    expect(buildAnalysisInput({ ...record(), filesComplete: false }).partial).toBe(true);
  });

  it('长代码和大量文件受限，JSON 转义后仍不超过字符预算', () => {
    const value = record();
    const patch = '\u0001"\\'.repeat(100_000);
    value.files = Array.from({ length: 3000 }, (_, i) => ({ ...value.files[0]!, path: `${i}/${'目录'.repeat(200)}`, patch }));
    const input = buildAnalysisInput(value);
    expect(input.text.length).toBeLessThanOrEqual(AI_INPUT_MAX_CHARS);
    expect(input.partial).toBe(true);
    expect(JSON.parse(input.text).files.length).toBeGreaterThan(0);
  });

  it('只调用配置的模型，JSON 分类结果不执行代码或 HTML', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(JSON.stringify({ changeType: 'agent', changeSummary: '<script>不执行</script>' })));
    const result = await analyzeWithAI(record(), config, fetcher);
    expect(result).toEqual({ changeType: 'agent', changeSummary: '<script>不执行</script>', partial: false });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://provider.example/v1/chat/completions');
    expect(options.redirect).toBe('error');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('test-model');
    expect(body.tools).toBeUndefined();
    expect(body.messages[0].content).toContain('不可信数据');
  });

  it.each([429, 500, 503])('只把临时 HTTP %i 视为可重试', async (status) => {
    await expect(analyzeWithAI(record(), config, vi.fn().mockResolvedValue(new Response('', { status })))).rejects.toMatchObject({ retryable: true });
  });

  it.each([400, 401, 403])('HTTP %i 不重试、不泄露响应', async (status) => {
    await expect(analyzeWithAI(record(), config, vi.fn().mockResolvedValue(new Response('provider-secret', { status })))).rejects.toMatchObject({ retryable: false, message: 'PR analysis failed' });
  });

  it('拒绝输出截断、错误类别、非 JSON 和超大响应', async () => {
    for (const response of [reply('{}', 'length'), reply('{"changeType":"invented","changeSummary":"说明"}'), reply('not-json'), new Response('x'.repeat(65_537))]) {
      await expect(analyzeWithAI(record(), config, vi.fn().mockResolvedValue(response))).rejects.toMatchObject({ retryable: false });
    }
  });

  it('超时可重试；配置缺失或非 HTTPS 在调用前失败', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(analyzeWithAI(record(), config, fetcher)).rejects.toMatchObject({ retryable: true });
    expect(() => aiEndpoint({ ...config, PR_CHANGE_LOG_AI_API_BASE: 'http://provider.example/v1' })).toThrow(AnalysisError);
    const unused = vi.fn();
    await expect(analyzeWithAI(record(), { ...config, PR_CHANGE_LOG_AI_API_KEY: undefined }, unused)).rejects.toThrow(AnalysisError);
    expect(unused).not.toHaveBeenCalled();
  });
});
