import { describe, expect, it, vi } from 'vitest';
import type { PrChangeLogConfig } from './pr-change-log.config';

vi.mock('../../lib/prisma', () => ({ prisma: {} }));

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
};

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
    expect(prChangeLogConfigSchema.parse({})).not.toHaveProperty('PR_CHANGE_LOG_ADMIN_USER_ID');
    expect(allowedRepositories(config)).toEqual(['owner/repo', 'owner/second']);
    expect(() => parseCursor('not-json')).toThrow('分页游标无效');
    expect(listQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

const review = () => ({
  status: 'succeeded', conclusion: 'no_concerns_found', headSha: 'a'.repeat(40),
  baseSha: 'b'.repeat(40), runUrl: 'https://github.com/owner/repo/actions/runs/123',
  coverage: { status: 'full', skippedFiles: [], partialFiles: [] }, findings: [],
});
describe('接收 PR-Agent 结果，不另调模型', () => {
  it('接收分类、中文摘要和结构化审查，内容摘要包含审查结果', () => {
    const value = ingestSchema.parse({ ...raw(), changeType: 'frontend', changeSummary: '精简页面', review: review() });
    expect(value.review?.conclusion).toBe('no_concerns_found');
    expect(contentHash(value)).not.toBe(contentHash({ ...value, review: null }));
  });
  it.each([
    { headSha: 'c'.repeat(40) }, { runUrl: 'https://github.com/other/repo/actions/runs/1' },
    { runUrl: 'https://github.com/owner/repo/actions/runs/1?secret=x' },
    { coverage: { status: 'full', skippedFiles: ['missing.ts'] } },
    { status: 'failed' }, { findings: [{ path: 'a.ts', title: 'x', body: 'x', startLine: 10, endLine: 1 }] },
  ])('拒绝过期、来源不符和夸大覆盖：%j', (patch) => {
    expect(ingestSchema.safeParse({ ...raw(), review: { ...review(), ...patch } }).success).toBe(false);
  });
  it('失败与部分审查仍可保存代码；旧上报兼容但不排队', () => {
    expect(ingestSchema.parse(raw()).review).toBeNull();
    const value = ingestSchema.parse({ ...raw(), review: { ...review(), status: 'failed', conclusion: 'unknown', coverage: { status: 'unknown' } } });
    expect(value.changeType).toBe('unknown');
    expect(value.review?.status).toBe('failed');
  });
  it('审查结果体积有界', () => {
    const findings = Array.from({ length: 40 }, () => ({ path: 'a.ts', title: '问题', body: 'x'.repeat(9000) }));
    expect(ingestSchema.safeParse({ ...raw(), review: { ...review(), findings } }).success).toBe(false);
  });
});
