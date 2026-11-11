# PR 改动记录模块

独立模块名 `pr-change-log`。一个 PR 只有一条最新记录，只有两张表：`pr_change_logs` 和 `pr_change_log_files`。不接 GitHub Webhook，不保存历史 diff、上报流水或模型原始响应，不包含部署能力。

## 本地与配置

```sh
pnpm prisma:generate
pnpm build
pnpm dev:pr-change-log
# 另一个终端显式启动分析进程；API 自身不会启动 AI。
pnpm worker:pr-change-log
# 生产构建后的独立进程入口（本次未部署）
pnpm start:pr-change-log-worker
```

迁移文件 `prisma/migrations/20261111000000_add_pr_change_log/migration.sql` 只准备，不自动应用。部署前须单独审核、备份并按现有方式应用迁移。不要把集成测试指向已有业务库。`APP_MODULES=pr-change-log` 只注册本模块和复用的 `/api/auth`；`all` 包含本模块，但缺少本模块配置不会启动模型或放开权限。

| 环境变量 | 用途 |
| --- | --- |
| `PR_CHANGE_LOG_ADMIN_USER_ID` | 现有 `User.id`，仅此账号可读和重新分析；未填拒绝访问 |
| `PR_CHANGE_LOG_INGEST_TOKEN` | 独立、至少 32 字符的随机上报密钥；未填或太短关闭上报 |
| `PR_CHANGE_LOG_REPOSITORIES` | 允许上报的 `owner/repo`，多个用逗号分隔；不支持通配，未填关闭上报 |
| `PR_CHANGE_LOG_AI_API_BASE` | HTTPS、无凭证／查询／片段的 OpenAI 兼容基础地址，例如 `https://provider.example/v1` |
| `PR_CHANGE_LOG_AI_API_KEY` | 专用模型 Key，留在后端 |
| `PR_CHANGE_LOG_AI_MODEL` | 供应商实际支持的原生模型 ID，不自动添加或移除 `openai/` |

用户登录沿用 `POST /api/auth/login` 的邮箱和密码，返回 `data.token`；查询使用 `Authorization: Bearer <用户 JWT>`。每次校验账号存在且匹配管理员；普通账号和面经游客不可访问。没有新账号表或游客入口。用户 JWT 与上报密钥互不通用。

AI 三项必须完整配置后才能显式启动分析进程，不使用生产平台或 PR-Agent 凭证回退。后端没有 GitHub Token，也不根据上报 URL 发起网络请求。读取源码需要登录；接口返回 `Cache-Control: no-store`。不将 Key 放进前端、Git 或日志。

## 接口

统一前缀 `/api/pr-change-log`。成功为 `{ "success": true, "data": ... }`，失败为 `{ "success": false, "message": "..." }`。

| 方法 | 地址 | 鉴权与行为 |
| --- | --- | --- |
| GET | `/me` | 管理员 JWT；`{ userId, canRead: true }` |
| GET | `/records` | 管理员 JWT；全库搜索、筛选与游标分页 |
| GET | `/records/:id` | 管理员 JWT；最新 PR、文件和 diff |
| POST | `/ingest` | 上报密钥；接收完成返回 202，不等待 AI |
| POST | `/records/:id/reanalyze` | 管理员 JWT；成功／失败的记录重新排队，返回 202 |

列表参数：`q`（标题、仓库、PR 发起人、提交 SHA 或完整 PR 编号），`repository`，`changeType`，`limit`（默认 50、最多 100），`cursor`。按 GitHub PR 创建时间、UUID 双降序排列。`cursor` 使用返回的不透明 `nextCursor`，筛选变化后从首页开始。列表不读取文件和 diff，不包含数据库内部运行编号和哈希。

```json
{
  "success": true,
  "data": {
    "items": [{
      "id": "cbe5d0ee-94e7-4bda-9b48-cf1cb49ab620",
      "repository": "owner/repo",
      "number": 48,
      "title": "简化编辑器",
      "author": "developer",
      "url": "https://github.com/owner/repo/pull/48",
      "createdAt": "2026-11-11T00:00:00.000Z",
      "updatedAt": "2026-11-11T01:00:00.000Z",
      "sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "headSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "fileCount": 1,
      "filesComplete": true,
      "changeType": "frontend",
      "changeSummary": "简化角色编辑交互。",
      "analysisStatus": "succeeded",
      "analysisCoverage": "full"
    }],
    "nextCursor": null
  }
}
```

详情 `data` 是一条相同格式记录，额外包含 `files`，见下面上报示例。文件额外映射 `patchTruncated` 和 `binary` 布尔值，兼容既有前端。`createdAt` 始终为 PR 创建时间，`author` 仅为 PR 发起人。`analysisCoverage` 仅在成功时为 `full` 或 `partial`，否则为 null；`filesComplete` 独立表达文件名单是否完整。

未知 diff、行数返回 null，不能解释为零改动。`patchStatus=missing` 不代表二进制；`binary` 必须由采集端有依据地确认。HTML、代码和中文说明全部是文本，前端不得执行或直接注入 HTML。

### Actions 上报合同

`Authorization: Bearer <独立上报密钥>`，`Content-Type: application/json`，请求上限 8 MiB。请求字段严格校验，类型由后端 AI 生成，不接受调用方上传分类和模型意见。

```json
{
  "repository": "owner/repo",
  "number": 48,
  "title": "简化编辑器",
  "author": "developer",
  "url": "https://github.com/owner/repo/pull/48",
  "createdAt": "2026-11-11T00:00:00Z",
  "headSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "fileCount": 1,
  "filesComplete": true,
  "sourceRunNumber": "120",
  "sourceRunAttempt": 1,
  "files": [{
    "path": "web/editor.js",
    "previousPath": null,
    "status": "modified",
    "additions": 1,
    "deletions": 1,
    "patch": "@@ -1 +1 @@\n-old\n+new",
    "patchStatus": "available",
    "url": "https://github.com/owner/repo/pull/48/files"
  }]
}
```

- `repository` 归一为小写，PR 链接必须与其编号一致；文件链接只能是同仓库的 GitHub HTTPS 地址。
- 文件 `status`：`added / modified / deleted / renamed / unknown`。采集端把 GitHub `removed` 映射为 `deleted`；重命名必须提供 `previousPath`。
- `patchStatus`：`available / truncated / missing / binary`。可用／截断时提供非空 patch，缺失／二进制时 patch 为 null。可选行数和链接默认 null。
- `fileCount` 为 GitHub 提供的文件总数，`filesComplete=true` 要求与数组长度相同；false 时允许只提供部分文件。接口最大 3000 个文件，不偷偷裁剪。过大内容由采集端明确截断并打标，超限请求返回 413，不落半份数据。
- 每个仓库只使用**一个固定同步工作流**，`sourceRunNumber` 使用该工作流 `github.run_number` 的十进制字符串，不是 run_id，也不能混用另一个工作流计数；attempt 使用 `github.run_attempt`。工作流迁移／计数重置须单独处理，不自动接受更小版本。
- 上报快照在一次运行／attempt 内保持不变，网络重试发送同一份 JSON。较小运行编号／attempt 返回 `ignored_stale`；相同版本相同内容为 `unchanged`，不同内容为 409。更高版本相同内容只推进来源版本，不重建文件、不再次调用 AI。
- 成功数据为 `{ id, status }`，status 为 `created / updated / unchanged / ignored_stale`。PR 和所有文件在事务中原子替换。没有历史记录表；最新内容改变时清空旧分析，避免展示过时结论。

后续 Actions 接入应与 PR-Agent 独立、仅授予读取 PR 权限，使用 GitHub API 获取完整分页，并在读取前后确认 head SHA 没有变化；变化时丢弃本次快照重新采集。不运行 PR 代码，不把标题／代码拼接进 Shell，不包含部署步骤。此轮只提供合同，**未修改任何 GitHub 工作流、Secrets、权限或线上服务**。

### 状态码

400 参数／JSON／游标无效；401 未登录或密钥错误；403 非管理员或仓库不在白名单；404 无记录；409 同版本冲突或已在分析队列；413 请求超过 8 MiB；503 上报配置未就绪；500 内部错误。重新分析不接受浏览器自带上报密钥。

## 两张表和 AI 任务

完整字段以 Prisma schema 和迁移为准：主表唯一键 `(repository, pr_number)`，排序索引 `(pr_created_at DESC, id DESC)`；文件唯一键 `(pr_id, path)`，关联删除级联。主表只保存页面需要的 PR 字段和最小分析控制字段，不保存分支、PR 全文、状态历史、GitHub 运行流水、错误原文、费用或模型原始响应。

后台扫描主表，`FOR UPDATE SKIP LOCKED` 与条件更新保证单次领取。每轮至多两次模型调用（首次＋一次临时失败重试），60 秒请求超时；429、5xx、网络错误可重试，鉴权失败、输出截断或非法 JSON 直接失败。API 错误不会删除 PR 或文件。失败后可以人工重新排队，属于新一轮、可能再次收费。

领取标识复用 `analysis_started_at` 的严格递增毫秒时间，结合 `content_hash` 和尝试次数做条件写入；输入更新、租约过期或手动重排后，旧持有者不能写结果。租约 180 秒，进程退出可恢复；第二次中断后标失败，不产生第三次调用。SIGTERM 停止领取新分析，当前受 60 秒超时约束的请求继续完成。API 可在分析 worker 未运行时正常收录和查询。

AI 只生成 `changeType` 和最多 1000 字符中文说明。Agent 包括提示词、角色、模型配置和执行逻辑；多类为 mixed，证据不足为 unknown。没有外部工具、自动改代码或执行 PR 指令的能力。

AI 输入优先保留完整文件标识，再均衡分配 diff 样本；单文件最多 4000 字符、序列化输入总计不超过 60000 字符，输出预算 1500 Token。**字符限制不是 Token 保证**，供应商上下文不足时会正常失败，不自动切模型／加预算。文件名单或 diff 有缺失／裁剪／二进制时保守标为 partial。`full` 仅表示输入未被本模块裁剪且上报标记完整，不是代码审查全覆盖或正确性保证。

## 测试与前端衔接

```sh
pnpm test:pr-change-log
pnpm test
pnpm build
DATABASE_URL=postgresql://localhost/pr_change_log_unused pnpm exec prisma validate
# 仅使用事先创建的本机独立空库，名称严格符合 pr_change_log_*_test。
PR_CHANGE_LOG_TEST_DATABASE_URL=postgresql://localhost/pr_change_log_example_test pnpm test:pr-change-log:integration
```

未提供测试 URL 时集成测试显式跳过；提供时拒绝远程库、错误名字及非空 public schema。测试只在此空库创建 User 和本模块两张表，不应用其他产品的迁移。AI 使用桩，HTTP 在本机随机端口启动，不读取真实供应商配置或发起模型调用。

前端尚未联调：需添加既有账号登录、Bearer JWT、`data` 解包、服务端筛选分页、分析状态和覆盖不足提示。现有无登录的纯前端不能直接查看受保护接口。不要把后端上报密钥／模型 Key 当浏览器数据源密码。此次不改前端和投资平台。
