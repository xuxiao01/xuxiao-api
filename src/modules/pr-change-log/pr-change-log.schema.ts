import { z } from 'zod';

export const changeTypeSchema = z.enum(['frontend', 'backend', 'agent', 'mixed', 'unknown']);
export const idSchema = z.uuid();
const count = z.number().int().min(0).max(2147483647);
export const repositorySchema = z.string().regex(/^[a-z\d][a-z\d-]{0,38}\/[a-z\d_.-]{1,100}$/i).transform((value) => value.toLowerCase());
const githubUrl = z.url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password;
}, '只允许无凭证的 GitHub HTTPS 地址');
const path = z.string().min(1).max(1024)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 1024, '文件路径不能超过 1024 字节')
  .refine((value) => !/[\x00-\x1f\x7f]/.test(value), '文件路径不能包含控制字符');
const fileSchema = z.object({
  path,
  previousPath: path.nullable().default(null),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'unknown']),
  additions: count.nullable().default(null),
  deletions: count.nullable().default(null),
  patch: z.string().max(8 * 1024 * 1024).nullable().default(null),
  patchStatus: z.enum(['available', 'truncated', 'missing', 'binary']),
  url: githubUrl.nullable().default(null),
}).strict().superRefine((file, ctx) => {
  if (['available', 'truncated'].includes(file.patchStatus) && !file.patch) {
    ctx.addIssue({ code: 'custom', path: ['patch'], message: '可用或截断的差异必须提供文本' });
  }
  if (['missing', 'binary'].includes(file.patchStatus) && file.patch !== null) {
    ctx.addIssue({ code: 'custom', path: ['patch'], message: '缺失或二进制文件不能提供文本差异' });
  }
  if (file.status === 'renamed' && !file.previousPath) {
    ctx.addIssue({ code: 'custom', path: ['previousPath'], message: '重命名必须提供原路径' });
  }
});

const shaSchema = z.string().regex(/^(?:[a-f\d]{40}|[a-f\d]{64})$/i).transform((value) => value.toLowerCase());
export const reviewSchema = z.object({
  status: z.enum(['succeeded', 'failed', 'unavailable']),
  conclusion: z.enum(['no_concerns_found', 'needs_review', 'changes_required', 'unknown']).default('unknown'),
  headSha: shaSchema,
  baseSha: shaSchema.nullable().default(null),
  runUrl: githubUrl,
  coverage: z.object({
    status: z.enum(['full', 'partial', 'unknown']),
    skippedFiles: z.array(path).max(3000).default([]),
    partialFiles: z.array(path).max(3000).default([]),
  }).strict(),
  findings: z.array(z.object({
    path, startLine: count.nullable().default(null), endLine: count.nullable().default(null),
    title: z.string().max(500), body: z.string().max(10_000),
  }).strict().refine((finding) => finding.startLine === null || finding.endLine === null || finding.endLine >= finding.startLine, '问题结束行不能小于开始行')).max(100).default([]),
}).strict().superRefine((review, ctx) => {
  if (Buffer.byteLength(JSON.stringify(review), 'utf8') > 256 * 1024) {
    ctx.addIssue({ code: 'custom', message: '审查结果不能超过 256 KiB' });
  }
  if (review.coverage.status === 'full' && (review.coverage.skippedFiles.length || review.coverage.partialFiles.length || review.status !== 'succeeded')) {
    ctx.addIssue({ code: 'custom', message: '审查失败或存在遗漏时不能声明完整覆盖' });
  }
});

export const ingestSchema = z.object({
  repository: repositorySchema,
  number: z.number().int().positive().max(2147483647),
  title: z.string().trim().min(1).max(1000),
  author: z.string().trim().min(1).max(100),
  url: githubUrl,
  createdAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  headSha: z.string().regex(/^(?:[a-f\d]{40}|[a-f\d]{64})$/i).transform((value) => value.toLowerCase()),
  fileCount: count,
  filesComplete: z.boolean(),
  sourceRunNumber: z.string().regex(/^[1-9]\d{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n, '运行编号过大'),
  sourceRunAttempt: z.number().int().positive().max(2147483647),
  files: z.array(fileSchema).max(3000),
  changeType: changeTypeSchema.default('unknown'),
  changeSummary: z.string().trim().max(1000).nullable().default(null),
  review: reviewSchema.nullable().default(null),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.files.map((file) => file.path)).size !== input.files.length) {
    ctx.addIssue({ code: 'custom', path: ['files'], message: '文件路径不能重复' });
  }
  if (input.fileCount < input.files.length || (input.filesComplete && input.fileCount !== input.files.length)) {
    ctx.addIssue({ code: 'custom', path: ['fileCount'], message: '文件总数与完整性标记不一致' });
  }
  const prUrl = new URL(input.url);
  if (prUrl.pathname.toLowerCase() !== `/${input.repository}/pull/${input.number}` || prUrl.search || prUrl.hash) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'PR 地址与仓库和编号不一致' });
  }
  for (const file of input.files) {
    if (file.url && !new URL(file.url).pathname.toLowerCase().startsWith(`/${input.repository}/`)) {
      ctx.addIssue({ code: 'custom', path: ['files'], message: '文件地址必须属于同一仓库' });
    }
  }
  if (input.review) {
    const runUrl = new URL(input.review.runUrl);
    const parts = runUrl.pathname.toLowerCase().split('/');
    if (input.review.headSha !== input.headSha || parts.slice(1, 3).join('/') !== input.repository
      || parts[3] !== 'actions' || parts[4] !== 'runs' || !/^[0-9]+$/.test(parts[5] ?? '')
      || parts.length !== 6 || runUrl.search || runUrl.hash) {
      ctx.addIssue({ code: 'custom', path: ['review'], message: '审查结果必须属于本 PR 提交和同仓库的 Actions 运行' });
    }
    if (!input.filesComplete && input.review.coverage.status === 'full') {
      ctx.addIssue({ code: 'custom', path: ['review'], message: '文件列表不完整时不能声明完整覆盖' });
    }
  }
  if (input.changeType !== 'unknown' && input.review?.status !== 'succeeded') {
    ctx.addIssue({ code: 'custom', path: ['changeType'], message: '明确分类必须附带成功的本轮审查结果' });
  }
});

export type IngestInput = z.infer<typeof ingestSchema>;

export const cursorSchema = z.object({ date: z.iso.datetime(), id: idSchema }).strict();
export const listQuerySchema = z.object({
  q: z.string().trim().max(200).default(''),
  repository: repositorySchema.optional(),
  changeType: changeTypeSchema.optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export type ListQuery = z.infer<typeof listQuerySchema>;
