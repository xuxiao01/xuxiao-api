# PR 改动记录

使用 PR-Agent 已生成的审查结果。后端只鉴权、校验和保存，不调用模型，也不运行分析 worker。一个 PR 始终更新同一条记录，只有 `pr_change_logs`、`pr_change_log_files` 两张表。

## 配置与权限

- 查询复用 `POST /api/auth/login` 返回的 `data.token`，使用 `Authorization: Bearer <用户 JWT>`。每次检查 JWT 和真实 User 是否存在；所有有效登录用户可读全部允许上报的仓库记录。没有管理员 ID 限制，没有游客入口。
- Actions 上报单独使用 `PR_CHANGE_LOG_INGEST_TOKEN`（至少 32 个随机字符）及 `PR_CHANGE_LOG_REPOSITORIES`（逗号分隔的精确 owner/repo 白名单）。用户 JWT 不能上报，机器密钥不能读取记录。未配置这两项时上报关闭，但登录查询仍可用。
- 不再需要 `PR_CHANGE_LOG_ADMIN_USER_ID` 或 `PR_CHANGE_LOG_AI_*`；旧环境变量被忽略。前端不得持有上报密钥、模型 Key 或 GitHub Token。
- `APP_MODULES=pr-change-log` 注册本模块及既有登录接口；`all` 也包含本模块。不自动启动任何后台分析。
- 接口使用 `Cache-Control: no-store`，代码与评论按不可信文本提供。后端不会访问上报 URL。

## 五个兼容入口

所有响应沿用 `{ success, data }` 或 `{ success: false, message }`。

| 方法 | 地址 | 行为 |
| --- | --- | --- |
| GET | `/api/pr-change-log/me` | 有效用户 JWT，返回 userId 与 canRead |
| GET | `/api/pr-change-log/records` | 搜索、分类、创建时间倒序游标分页 |
| GET | `/api/pr-change-log/records/:id` | PR、完整审查 JSON、修改文件与 diff |
| POST | `/api/pr-change-log/ingest` | 独立上报密钥，校验后事务写入，202 |
| POST | `/api/pr-change-log/records/:id/reanalyze` | 兼容旧地址；登录后返回 410，提示去 GitHub 重新审查，不写库 |

列表参数：`q`（标题、作者、仓库、SHA、完整 PR 编号）、`repository`、`changeType`、`limit`（默认 50，最多 100）、`cursor`。响应为 `{ items, nextCursor }`；筛选变化后清除游标。按 PR 创建时间和 UUID 双降序，列表查询不读取 review JSON、文件或 patch。

## 上报合同

```json
{
  "repository": "owner/repo",
  "number": 48,
  "title": "精简配置页面",
  "author": "developer",
  "url": "https://github.com/owner/repo/pull/48",
  "createdAt": "2026-11-11T00:00:00Z",
  "headSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "fileCount": 1,
  "filesComplete": true,
  "sourceRunNumber": "100",
  "sourceRunAttempt": 1,
  "changeType": "frontend",
  "changeSummary": "精简配置页面，保留保存与权限规则。",
  "review": {
    "status": "succeeded",
    "conclusion": "no_concerns_found",
    "headSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "baseSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "runUrl": "https://github.com/owner/repo/actions/runs/123",
    "coverage": { "status": "partial", "skippedFiles": ["large.css"], "partialFiles": [] },
    "findings": [{ "path": "web/editor.js", "startLine": 1, "endLine": 1, "title": "审查意见", "body": "问题与建议，按纯文本显示。" }]
  },
  "files": [{
    "path": "web/editor.js", "previousPath": null, "status": "modified",
    "additions": 1, "deletions": 1, "patch": "@@ -1 +1 @@\n-old\n+new",
    "patchStatus": "available", "url": null
  }]
}
```

- 分类：frontend / backend / agent / mixed / unknown。Agent 指提示词、角色、模型配置和执行逻辑。分类由 PR-Agent 在原审查中附带，不是发布分类；失败时为 unknown，不按路径猜测。中文说明最多 1000 字符。
- `review` 可空以兼容旧上报；无结果不排队、不调用 AI。status 为 succeeded / failed / unavailable；conclusion 为 no_concerns_found / needs_review / changes_required / unknown。无明显问题只表示审查范围内的结论，不能作为完整通过证明。
- review 最多 256 KiB、100 条意见；意见保留路径、起止行、标题和说明。绑定同一个 headSha 及同仓库 Actions 地址。完整覆盖必须审查成功、无遗漏且文件列表完整；未知与部分覆盖明确区分。
- file 状态：added / modified / deleted / renamed / unknown。patchStatus：available / truncated / missing / binary。missing 不能被当成 binary；重命名要求 previousPath。最多 3000 文件，路径最多 1024 UTF-8 字节，请求总大小最多 8 MiB。
- 不保存原始模型输出、提示上下文、用量或上报历史。列表与详情的 id 是 UUID。

## 去重与乱序

PR 与文件在同一事务中写入，以 repository + PR number 唯一。事务内 advisory lock 隔离首次并发插入。sourceRunNumber、sourceRunAttempt 决定先后顺序；旧运行晚到被忽略；同一版本内容不一致返回 409；相同内容只推进运行版本，不重复替换文件。内容哈希包含分类、中文说明及审查结果。新 head 更新会替换旧文件和旧审查，不保留过时结果。

## 数据库兼容

历史迁移 `20261111000000_add_pr_change_log` 不改动；新增 `20261111160000_add_pr_change_log_review` 只给主表增加 nullable JSONB `review`，没有第三张表。旧 analysis 控制字段暂时保留，新的业务逻辑不再调度、领取或更新分析任务，也不向前端返回旧分析状态。旧记录无 review 时显示“尚无本次审查结果”。迁移只在隔离测试库执行过，业务库需另行按现有发布方式应用。

## 本地验证

```sh
pnpm prisma:generate
pnpm exec prisma validate
pnpm test
pnpm build
# 必须是本机、名字以 pr_change_log_ 开头且 _test 结尾的全新空库：
PR_CHANGE_LOG_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:5432/pr_change_log_example_test pnpm test:pr-change-log:integration
```

测试自行创建所需表，拒绝非本机或非空库；使用测试账号和模拟审查结果，不调用 AI、GitHub 或业务服务。旧 worker 源码和启动命令已删除；本次不替你停用任何线上进程或部署服务。
