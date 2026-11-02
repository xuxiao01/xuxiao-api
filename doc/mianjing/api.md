# 面经台接口

基础路径：`/api/mianjing`。除游客入口外，需要 `Authorization: Bearer <token>`。

管理员复用 `POST /api/auth/login`，随后请求 `/me`。服务端配置 `MIANJING_ADMIN_USER_ID=2`，只有对应账号可进入；其他已有账号返回 403。账号被删除或 Token 无效时返回 401。其他产品的认证、注册不变；面经前端不提供注册入口。

游客通过公开 `POST /api/mianjing/auth/guest` 获取 `{token,expiresIn:3600}`。不创建账号或会话表。JWT 使用独立 `MIANJING_GUEST_JWT_SECRET`、HS256、audience/issuer=mianjing、purpose=mianjing、role=guest，一小时过期。密钥至少 32 字符且不得与既有 JWT_SECRET 相同；未就绪返回 503。游客只读，所有写接口 403，游客 Token 无法通过其他产品的 JWT 校验。

响应沿用 `{ success: true, data }` 与 `{ success: false, message }`。JSON 字段为 camelCase，时间为 UTC ISO 字符串。新建返回 201，读取、编辑与删除返回 200；400 参数错误，401 未登录或账号失效，403 无写权限，404 资源不存在，409 次数超出安全范围，413 超过 2 MiB。没有版本号、expectedVersion、expectedRevision。

## 表与字段

### mianjing_questions

| JSON / 数据库字段        | 类型           | 规则                                                      |
| ------------------------ | -------------- | --------------------------------------------------------- |
| id                       | UUID           | 服务端生成                                                |
| title                    | TEXT           | 去首尾空白，1–10000 字符                                  |
| category                 | ENUM           | 八股／手撕／算法／场景题                                  |
| tags                     | TEXT[]         | 知识点，默认 []，最多 100 个，每个 1–100 字符，去空白去重 |
| companyIds / company_ids | UUID[]         | 默认 []，保留顺序，去重，最多 500 个                      |
| priority                 | ENUM           | 高／中／低，默认中                                        |
| mastery                  | ENUM           | 不会／模糊／基本掌握／熟练，默认模糊                      |
| organized                | BOOLEAN        | 默认 false                                                |
| baseCount / base_count   | BIGINT         | 手动补充次数，默认 0，不直接通过请求修改                  |
| createdAt / created_at   | TIMESTAMPTZ(3) | 服务端创建时间                                            |
| updatedAt / updated_at   | TIMESTAMPTZ(3) | 最近修改时间                                              |

`totalCount = baseCount + recordCount`，均以非负 JavaScript 安全整数返回，不直接序列化 BigInt。普通编辑不修改次数。修改总次数时按事务内最新记录数计算 baseCount，不能低于记录数。创建记录若导致总次数超过安全范围，整个操作失败。

### mianjing_companies

`id UUID`、`name VARCHAR(100) UNIQUE`、`palette ENUM`、`sort_order INTEGER`、`enabled BOOLEAN`。

palette 为 `teal/orange/yellow/red/coral/blue/purple/gray/white/black`。排序由配置数组顺序产生；仅维护公司，不管理历史别名或版本。名称区分大小写，去除首尾空白后必须唯一。

### mianjing_occurrences

`id UUID`、`question_id UUID`、`company_id UUID`、`content TEXT`、`created_at TIMESTAMPTZ(3)`、可空 `recruitment_type ENUM`、可空 `round ENUM`。

content 最多 200000 字符，去首尾空白、保留内部换行。快速新增必填，编辑允许清空。招聘类型和轮次必须同时为空或同时存在，仅在新增题目的来源中设置，不提供后续修改这两项的接口。

同题同公司可以出现多次，没有组合唯一限制。question_id 外键级联删除，company_id 外键禁止公司被物理删除。题目的 company_ids 数组由服务层校验；不增加关联表。

## 接口总览

| 方法   | 路径                       | 权限   | 作用                 |
| ------ | -------------------------- | ------ | -------------------- |
| POST   | /auth/guest                | 公开   | 获取一小时游客 Token |
| GET    | /me                        | 登录   | 当前账号与权限       |
| GET    | /questions                 | 登录   | 服务端列表           |
| GET    | /questions/:id             | 登录   | 详情与记录           |
| GET    | /company-catalog           | 登录   | 完整公司库           |
| POST   | /questions                 | 管理员 | 新增题目             |
| PATCH  | /questions/:id             | 管理员 | 标准信息编辑         |
| PATCH  | /questions/:id/meta        | 管理员 | 标签、状态、总次数   |
| POST   | /questions/:id/occurrences | 管理员 | 快速记录             |
| PATCH  | /occurrences/:id           | 管理员 | 编辑内容             |
| PUT    | /company-catalog           | 管理员 | 保存完整公司库       |
| DELETE | /questions/:id             | 管理员 | 直接删除题目与记录   |
| DELETE | /occurrences/:id           | 管理员 | 直接删除一条记录     |

## 读取

### GET /me

data：`{role:"admin"|"guest",user:{id,email,username}|null,isAdmin,canEdit}`。游客 user=null、isAdmin=false、canEdit=false；管理员两项权限均为 true。

### GET /company-catalog

data：`{ items: [{ id, name, palette, sortOrder, enabled }] }`。包含停用公司，按 sortOrder、id 稳定排序。初始为空，由管理员配置；不会自动填充演示数据。

### GET /questions

参数：`search`、`category`、`company`（UUID）、`mastery`、`organized`（字符串 true/false）、`sort`（priority/count/updated，默认 priority）、`page`（正整数，默认 1）、`pageSize`（10/20/50，默认 20）。非法值返回 400，不接受未知参数。

搜索按空白拆词，各词必须分别命中标题、知识点、公司标签名称或出现内容中的至少一处；英文忽略大小写，%、_、反斜杠按字面匹配。实际来源公司不代替独立公司标签参与公司筛选。标题命中的词数优先，再按所选排序，最后按 ID 排序。

priority 排序沿用前端：优先级权重×10＋掌握程度权重，再按总次数降序。updated 按最近修改时间降序，count 按总次数降序。

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 20,
    "usedCompanyIds": []
  }
}
```

items 每项包含题目全部标准字段，以及 `companies`（按 companyIds 顺序的公司对象）、`recordCount`、`totalCount`，不返回记录正文。usedCompanyIds 从整库标签数组去重取得，不随本次搜索筛选缩小；停用但仍被使用的公司仍可筛选。超出最大页码时自动返回最后有效页，空列表页码为 1。

### GET /questions/:id

data：`{ question, occurrences }`。question 与列表题目结构相同。每条 occurrence 包含 `id/questionId/companyId/company/content/createdAt/recruitmentType/round`，按记录时间降序、ID 升序；快速记录的招聘类型和轮次为 null。不返回答案、复习或版本字段。

## 写入

所有请求严格校验字段，未知字段返回 400。公司 ID 统一为小写 UUID。

### POST /questions

```json
{
  "title": "实现并发请求调度器",
  "category": "手撕",
  "tags": ["Promise", "并发控制"],
  "priority": "中",
  "mastery": "模糊",
  "organized": false,
  "source": {
    "companyId": "00000000-0000-4000-8000-000000000001",
    "recruitmentType": "暑期",
    "round": "一面"
  }
}
```

title、category 必填，其他标准字段使用上面的默认值。source 整体可省略；提供时三项必须完整，公司必须存在且启用。事务创建题目、第一条空内容记录，并把公司 ID 放入标签数组；省略来源时仅创建题目、次数为 0。返回新题目摘要。

### PATCH /questions/:id

只允许 `title/category/tags/priority/mastery/organized`，至少一项；未提交字段保持原值。返回更新后的题目摘要，不改变公司数组、记录或次数。

### PATCH /questions/:id/meta

至少提交 `companyIds/mastery/organized/totalCount` 中的一项。例如：

```json
{ "companyIds": [], "mastery": "熟练", "organized": true, "totalCount": 8 }
```

companyIds 可以清空，不影响来源记录或次数。已停用且当前仍选中的公司可保留或移除，但移除后不能重新添加；不存在的 ID 拒绝。totalCount 仅接受 0–9007199254740991 的整数，按最新明细数校验下限。返回更新后的题目摘要。

### POST /questions/:id/occurrences

```json
{
  "companyId": "00000000-0000-4000-8000-000000000001",
  "content": "这次具体怎么问，包括变形和追问"
}
```

公司、非空内容必填。禁止提交 recruitmentType、round 等其他字段；服务器生成时间，招聘类型与轮次均为 null。每次成功提交独立增加一条记录和一次计数，不按公司或内容合并。同时把公司 ID 补入标签数组并去重。返回新记录。

### PATCH /occurrences/:id

只接受 `{ "content": "修改后的内容" }`，允许空字符串。公司、招聘类型、轮次和创建时间不变；更新所属题目的 updatedAt，不新增记录。返回更新后的记录。

### PUT /company-catalog

```json
{
  "items": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "腾讯",
      "palette": "blue",
      "enabled": true
    },
    {
      "id": "00000000-0000-4000-8000-000000000002",
      "name": "百度",
      "palette": "white",
      "enabled": true
    }
  ]
}
```

客户端为新增公司生成 UUID；items 顺序即显示顺序，不提交 sortOrder。最多 500 家，不允许名称或 ID 重复，不能遗漏已存在公司，停用请提交 enabled:false。初始空库允许空配置；存在公司后不能通过空数组删除。

改名、配色、排序、启停一次事务保存，名称互换也支持。题目及记录通过 ID 读取新名称，无需复制更新。没有版本校验；提交涉及的修改以最后一次成功保存为准，但旧窗口遗漏其他窗口新增的公司会被拒绝，需要重新加载公司库。

### DELETE

删除题目时外键级联删除记录，保留公司库；删除单条记录时保留 baseCount 和题目公司标签，按剩余记录重新计算总次数。不存在返回 404，不提供恢复接口。成功 data 为 `{ id }`。前端应在实际删除前确认，成功后刷新列表、详情和分页。

## 并发与事务

写事务通过面经专属 PostgreSQL advisory lock 协调，不增加设置表，也不锁其他产品的业务表。对次数、公司启用状态和数组修改均读取事务内最新数据。公司库保存、新增题目与来源、新增记录与标签补入、修改次数及删除分别原子完成。

前端新增提交期间应禁用重复操作，不自动重试 POST；每次成功 POST 都会独立计次。事务失败不会保留部分数据。

## GET /health（公开）

返回 `{success:true,data:{status:"ready",apiVersion:1,commit:"40位SHA"}}`。检查管理员配置、独立游客密钥与三张表可访问；未就绪 503，仅返回通用提示。部署及前端发布门禁使用，不暴露凭据或业务数据。
