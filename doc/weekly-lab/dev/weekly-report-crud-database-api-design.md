# Weekly Lab 周报 CRUD 数据库与接口设计

> 版本：MVP 评审版  
> 日期：2026-06-25  
> 目标：先支持登录用户维护自己的周报，后续可扩展公开分享链接。

## 1. 背景与前端模型

当前前端数据是三层嵌套结构：

```text
WeeklyReportWeek（一周）
  ├── id: "2026-W24"
  ├── weekLabel / dateRange / shortDateRange
  └── reports[]（一周可有多页/多个部分）
        ├── WeeklyReport
        │     ├── partLabel: "第一部分"
        │     ├── title: "小墨作文小游戏开发"
        │     ├── completed[]   本周完成
        │     └── nextPlans[]   未来展望
        └── ReportListItem
              ├── title / description
              └── images?: string[]
```

典型场景：

- `2026-W24`：1 个 report，单项目周报。
- `2026-W23`：3 个 report，多项目/多部分周报。
- 条目以数组顺序展示。
- 图片目前是 OSS 外链 URL 数组。
- 未来工作台会支持 Markdown 导入，并覆盖或新增一周数据。

## 2. 设计原则

| 原则       | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| 用户隔离   | 所有周报数据最终归属于 `User.id`。                           |
| 对齐前端   | API 返回结构尽量复用现有 `WeeklyReportWeek` 类型，减少前端改动。 |
| 响应一致   | 沿用 `{ success, data }` / `{ success: false, message }`。   |
| 鉴权一致   | 写操作和“我的工作台”读操作使用 Bearer token。                |
| 周唯一     | 同一用户下 `week_key` 唯一，格式 `YYYY-W01` ~ `YYYY-W53`，如 `2026-W24`。 |
| 顺序保留   | 使用 `sort_order` 显式保存展示顺序，不依赖自增 id。          |
| MVP 简洁   | 对外只做“整周”的增删改查，report/item 只是内部结构，不单独暴露 CRUD。 |
| 业务周标识 | `week_key` 是业务周标识，格式固定，但不强制按 ISO 周自动推导日期。 |
| 展示日期   | `start_date/end_date` 是实际展示日期范围，后端只校验 `start_date <= end_date`。 |
| 公开双开关 | 公开展示需同时满足用户级 `public_weekly_reports_enabled` 与单篇 `is_published`。 |

## 3. 数据关系说明

三层关系如下：

```text
User
  └── weekly_report_weeks
        └── weekly_reports
              └── weekly_report_items
```

重要说明：

- `weekly_report_weeks.id` 是数据库内部的“周 id”。
- `weekly_report_weeks.week_key` 是前端展示用的一周业务标识，例如 `2026-W24`，不强制与 ISO 周起止日期一致。
- `weekly_report_weeks.start_date/end_date` 是实际展示用的日期范围。
- `weekly_reports.id` 是数据库内部的“某一页 report id”。
- `weekly_reports.week_id` 表示这个 report 属于哪一周。
- `weekly_report_items.report_id` 表示这个条目属于哪一页 report。

MVP 中，`weekly_reports` 不单独存 `user_id`。  
因为 report 的用户归属可以通过下面这条关系查出：

```text
weekly_reports.week_id
  -> weekly_report_weeks.id
  -> weekly_report_weeks.user_id
```

这样可以避免冗余字段带来的脏数据问题。

MVP 的对外 API 不按 report/item 做细粒度增删改查。  
数据库拆成三张表，是为了结构清晰、查询方便、后续可扩展；接口层仍然把一整周周报当成一个完整文档来创建、读取、覆盖保存和删除。

### 3.1 与现有 User 表的衔接

当前项目已有 `User` 表（Prisma model 名 `User`），核心字段：

| 字段 | 说明 |
| ---- | ---- |
| id | `Int`，自增主键 |
| email | 唯一，注册时已查重 |
| username | 当前与 email 相同，注册时不会重复 |

因此：

- 外键 `user_id` 使用 `INTEGER`，关联 `"User"(id)`。
- 公开路径中的 `:username` 使用用户的 `username` 字段（即邮箱）；`email` 已唯一，无需再单独给 `username` 加唯一约束。
- 本次在 `User` 表新增 `public_weekly_reports_enabled`，作为用户级公开周报总开关。

### 3.2 week_key 格式

`week_key` 统一格式为 **`YYYY-W01` ~ `YYYY-W53`**，周数固定两位，允许前导零。

合法示例：

- `2026-W01`
- `2026-W09`
- `2026-W24`
- `2026-W53`

非法示例：

- `2026-W1`（周数未补零）
- `2026-W54`（超出范围）
- `2026-W24-extra`

数据库层通过 CHECK 约束校验格式；接口层 path 参数 `:weekKey` 也须符合同一规则。

### 3.3 week_key 与 start_date/end_date 的关系

| 字段 | 含义 |
| ---- | ---- |
| `week_key` | 业务周标识，用于前端 `id`、URL path、用户维度唯一键 |
| `start_date` / `end_date` | 实际展示用的日期范围，用于生成 `dateRange` / `shortDateRange` |

规则：

- `week_key` **不强制**按 ISO 周自动推导 `start_date/end_date`。
- 后端**不要求** `week_key` 与 `startDate/endDate` 在 ISO 语义上严格匹配。
- 后端只校验：
  1. `week_key` 格式合法（`YYYY-W01` ~ `YYYY-W53`）
  2. `start_date <= end_date`（当日期字段参与校验时）
- 例如：`week_key = 2026-W24` 可以对应展示日期 `2026-06-08` ~ `2026-06-12`（5 个工作日），不必等于 ISO 第 24 周的完整起止日。

## 4. 数据库表结构

数据库：PostgreSQL  
时间字段的 `updated_at` 统一由 Prisma `@updatedAt` 维护，不使用数据库 trigger。

### 4.1 User 表扩展

在现有 `User` 表上新增字段：

| 字段                           | 类型    | 约束                   | 说明                               |
| ------------------------------ | ------- | ---------------------- | ---------------------------------- |
| public_weekly_reports_enabled  | BOOLEAN | NOT NULL DEFAULT false | 用户级公开周报总开关，默认关闭。   |

建议 SQL（迁移时执行）：

```sql
ALTER TABLE "User"
  ADD COLUMN public_weekly_reports_enabled BOOLEAN NOT NULL DEFAULT false;
```

Prisma schema 示例：

```prisma
model User {
  // ...existing fields
  publicWeeklyReportsEnabled Boolean @default(false) @map("public_weekly_reports_enabled")
  createdAt                  DateTime @default(now()) @map("created_at")
  updatedAt                  DateTime @updatedAt @map("updated_at")
}
```

### 4.2 weekly_report_weeks

保存“一周”的元信息。

MVP 推荐只保存核心业务字段。  
`weekLabel`、`dateRange`、`shortDateRange` 这些展示字段由后端根据 `week_key/start_date/end_date` 在接口返回时生成，不必落库，避免展示字段冗余。

| 字段         | 类型        | 约束                   | 说明                                           |
| ------------ | ----------- | ---------------------- | ---------------------------------------------- |
| id           | SERIAL      | PK                     | 数据库内部周 id。                              |
| user_id      | INTEGER     | NOT NULL, FK           | 所属用户，关联 `"User"(id)`。                  |
| week_key     | VARCHAR(16) | NOT NULL               | 业务周标识，格式 `YYYY-W01`~`YYYY-W53`，同一用户下唯一。 |
| start_date   | DATE        | NOT NULL               | 实际展示用的周起始日。                         |
| end_date     | DATE        | NOT NULL               | 实际展示用的周结束日。                         |
| is_published | BOOLEAN     | NOT NULL DEFAULT false | 单篇周报发布开关，默认关闭。                   |
| created_at   | TIMESTAMPTZ | NOT NULL DEFAULT now() | 创建时间。                                     |
| updated_at   | TIMESTAMPTZ | NOT NULL               | 更新时间，由 Prisma `@updatedAt` 自动维护。    |

建议 SQL：

```sql
CREATE TABLE weekly_report_weeks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  week_key VARCHAR(16) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_weekly_report_weeks_week_key
    CHECK (week_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
  CONSTRAINT chk_weekly_report_weeks_date_range
    CHECK (start_date <= end_date)
);

CREATE UNIQUE INDEX uk_weekly_report_weeks_user_week_key
  ON weekly_report_weeks (user_id, week_key);

CREATE INDEX idx_weekly_report_weeks_user_start_date
  ON weekly_report_weeks (user_id, start_date DESC);
```

说明：

- `week_key` 校验格式为 `YYYY-W01` ~ `YYYY-W53`，两位周数、允许前导零；它是业务周标识，不用于自动推算日期。
- 不根据 `week_key` 自动推算 `start_date/end_date`；日期由请求体传入（新建必填，更新可省略沿用原值），后端只校验 `start_date <= end_date`。
- MVP 不包含 `public_slug`、`share_token` 字段。

### 4.3 weekly_reports

保存一周中的“页/部分”。

| 字段       | 类型         | 约束                   | 说明                                                       |
| ---------- | ------------ | ---------------------- | ---------------------------------------------------------- |
| id         | SERIAL       | PK                     | report 的数据库 id，读取响应中可作为 `reports[].id` 返回。 |
| week_id    | INTEGER      | NOT NULL, FK           | 所属周，关联 `weekly_report_weeks(id)`。                   |
| sort_order | SMALLINT     | NOT NULL               | 周内顺序，从 1 开始。                                      |
| part_label | VARCHAR(32)  | NOT NULL               | 如 `第一部分`。                                            |
| title      | VARCHAR(255) | NOT NULL               | 报告主标题。                                               |
| created_at | TIMESTAMPTZ  | NOT NULL DEFAULT now() | 创建时间。                                                 |
| updated_at | TIMESTAMPTZ  | NOT NULL               | 更新时间，由 Prisma `@updatedAt` 自动维护。                |

建议 SQL：

```sql
CREATE TABLE weekly_reports (
  id SERIAL PRIMARY KEY,
  week_id INTEGER NOT NULL REFERENCES weekly_report_weeks(id) ON DELETE CASCADE,
  sort_order SMALLINT NOT NULL,
  part_label VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_weekly_reports_sort_order
    CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX uk_weekly_reports_week_sort
  ON weekly_reports (week_id, sort_order);

CREATE INDEX idx_weekly_reports_week_id
  ON weekly_reports (week_id);
```

### 4.4 weekly_report_items

保存 report 里的条目，包括“本周完成”和“未来展望”。

| 字段        | 类型        | 约束                   | 说明                                     |
| ----------- | ----------- | ---------------------- | ---------------------------------------- |
| id          | SERIAL      | PK                     | 条目数据库 id。MVP 全量替换时可能变化。  |
| report_id   | INTEGER     | NOT NULL, FK           | 所属 report，关联 `weekly_reports(id)`。 |
| section     | VARCHAR(16) | NOT NULL               | `completed` 或 `next_plans`。            |
| sort_order  | SMALLINT    | NOT NULL               | 区块内顺序，从 1 开始。                  |
| title       | TEXT        | NOT NULL               | 条目标题。                               |
| description | TEXT        | NOT NULL DEFAULT ''    | 条目描述。                               |
| images      | JSONB       | NOT NULL DEFAULT '[]'  | 图片 URL 数组。                          |
| created_at  | TIMESTAMPTZ | NOT NULL DEFAULT now() | 创建时间。                               |
| updated_at  | TIMESTAMPTZ | NOT NULL               | 更新时间，由 Prisma `@updatedAt` 自动维护。 |

建议 SQL：

```sql
CREATE TABLE weekly_report_items (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  section VARCHAR(16) NOT NULL,
  sort_order SMALLINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_weekly_report_items_section
    CHECK (section IN ('completed', 'next_plans')),
  CONSTRAINT chk_weekly_report_items_sort_order
    CHECK (sort_order > 0),
  CONSTRAINT chk_weekly_report_items_images_array
    CHECK (jsonb_typeof(images) = 'array')
);

CREATE UNIQUE INDEX uk_weekly_report_items_report_section_sort
  ON weekly_report_items (report_id, section, sort_order);

CREATE INDEX idx_weekly_report_items_report_id
  ON weekly_report_items (report_id);
```

**images 校验（双层）：**

| 层级 | 规则 |
| ---- | ---- |
| 数据库 | `CHECK (jsonb_typeof(images) = 'array')`，只保证是 JSON 数组 |
| 接口层 | Zod 校验，必须是 URL 字符串数组 |

接口层 Zod 示例：

```typescript
const reportItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  images: z.array(z.string().url()).default([]),
});
```

`images` 必须是 URL 字符串数组，不能是数字、对象、布尔值等非字符串元素。

### 4.5 时间字段维护方式（Prisma @updatedAt）

当前项目使用 Prisma，现有 `User` 模型已用 `@updatedAt`。  
周报相关表**不使用数据库 trigger**，统一在 Prisma schema 中声明：

- `createdAt` → `DateTime @default(now())`
- `updatedAt` → `DateTime @updatedAt`

Prisma schema 示例：

```prisma
model WeeklyReportWeek {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  weekKey     String   @map("week_key")
  startDate   DateTime @map("start_date") @db.Date
  endDate     DateTime @map("end_date") @db.Date
  isPublished Boolean  @default(false) @map("is_published")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  reports WeeklyReport[]

  @@unique([userId, weekKey])
  @@map("weekly_report_weeks")
}

model WeeklyReport {
  id        Int      @id @default(autoincrement())
  weekId    Int      @map("week_id")
  sortOrder Int      @map("sort_order")
  partLabel String   @map("part_label")
  title     String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  week  WeeklyReportWeek  @relation(fields: [weekId], references: [id], onDelete: Cascade)
  items WeeklyReportItem[]

  @@unique([weekId, sortOrder])
  @@map("weekly_reports")
}

model WeeklyReportItem {
  id          Int      @id @default(autoincrement())
  reportId    Int      @map("report_id")
  section     String
  sortOrder   Int      @map("sort_order")
  title       String
  description String   @default("")
  images      Json     @default("[]")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  report WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)

  @@unique([reportId, section, sortOrder])
  @@map("weekly_report_items")
}
```

说明：

- 通过 Prisma Client 写入时，`updatedAt` 会在 `update` 操作时自动刷新。
- `createdAt` 在 `create` 时自动写入当前时间。
- **除非未来绕过 Prisma 直接写库**（如手工 SQL、外部 ETL），否则不需要数据库 trigger。

### 4.6 weekly_report_import_logs，可选

MVP 非必须。  
如果后续希望排查 Markdown 导入覆盖问题，可以增加导入日志表。

| 字段         | 类型        | 说明                  |
| ------------ | ----------- | --------------------- |
| id           | SERIAL      | 主键。                |
| user_id      | INTEGER     | 操作用户。            |
| week_key     | VARCHAR(16) | 导入目标周。          |
| source       | VARCHAR(16) | 来源，如 `markdown`。 |
| raw_markdown | TEXT        | 原始 Markdown 内容。  |
| created_at   | TIMESTAMPTZ | 导入时间。            |

## 5. 鉴权方式

除公开展示接口外，所有接口都需要：

```http
Authorization: Bearer <token>
```

MVP 只操作整周周报，所以鉴权主要判断 `weekly_report_weeks.user_id` 是否等于当前登录用户 id。

示例：

```sql
SELECT *
FROM weekly_report_weeks
WHERE week_key = $1
  AND user_id = $2;
```

其中：

- `$1` 是 `weekKey`。
- `$2` 是当前登录用户 id。

查得到，说明这周周报属于当前用户。  
查不到，返回 `404` 或 `403`，具体看产品希望隐藏还是暴露权限信息。

MVP 推荐：

- 对外统一返回 `404`，避免泄露“这个 id 是否存在”。
- 内部日志记录真实原因。

## 6. API 设计

基础地址示例：

```text
http://localhost:3000
```

### 6.1 接口总览

| 方法   | 路径                                                  | 鉴权 | 说明                                                    |
| ------ | ----------------------------------------------------- | ---- | ------------------------------------------------------- |
| GET    | `/api/weekly-reports`                                 | 是   | 我的工作台：周报列表。                                  |
| GET    | `/api/weekly-reports/:weekKey`                        | 是   | 获取一周完整周报，含 reports 和 items。                 |
| PUT    | `/api/weekly-reports/:weekKey`                        | 是   | 新建或覆盖保存一整周周报，支持结构化 JSON 或 Markdown。 |
| DELETE | `/api/weekly-reports/:weekKey`                        | 是   | 删除整周周报，级联删除 reports/items。                  |
| POST   | `/api/uploads/images`                                 | 是   | 上传本地图片到自有 OSS，返回图片 URL。                  |
| GET    | `/api/public/users/:username/weekly-reports/:weekKey` | 否   | 公开展示，需满足用户级与单篇双开关。                    |

二期预留（MVP 不实现）：

| 方法 | 路径                                    | 说明                         |
| ---- | --------------------------------------- | ---------------------------- |
| GET  | `/api/share/weekly-reports/:shareToken` | 私密分享链接，需 `share_token` 字段。 |

## 7. 核心接口详情

### 7.1 GET /api/weekly-reports

获取当前登录用户的周列表摘要。

响应：

```json
{
  "success": true,
  "data": [
    {
      "id": "2026-W24",
      "weekLabel": "第 24 周",
      "dateRange": "2026.06.08 - 2026.06.12",
      "shortDateRange": "06.08 - 06.12",
      "reportCount": 1,
      "isPublished": false,
      "updatedAt": "2026-06-12T10:00:00.000Z"
    }
  ]
}
```

说明：

- 返回给前端的 `id` 使用 `week_key`，例如 `2026-W24`。
- `weekLabel/dateRange/shortDateRange` 由后端根据 `week_key/start_date/end_date` 生成；其中 `dateRange/shortDateRange` 以 `start_date/end_date` 为准。
- 列表按 `start_date DESC` 排序。

### 7.2 GET /api/weekly-reports/:weekKey

获取某一周完整数据。

响应建议直接对齐现有前端结构：

```json
{
  "success": true,
  "data": {
    "id": "2026-W24",
    "weekLabel": "第 24 周",
    "dateRange": "2026.06.08 - 2026.06.12",
    "shortDateRange": "06.08 - 06.12",
    "reports": [
      {
        "id": 1,
        "weekLabel": "第 24 周",
        "dateRange": "2026.06.08 - 2026.06.12",
        "shortDateRange": "06.08 - 06.12",
        "partLabel": "第一部分",
        "title": "小墨作文小游戏开发",
        "completed": [
          {
            "title": "文字翻翻卡开发",
            "description": "",
            "images": []
          }
        ],
        "nextPlans": [
          {
            "title": "整体 UI 优化",
            "description": "",
            "images": ["https://example.com/a.png"]
          }
        ]
      }
    ]
  }
}
```

说明：

- 外层 `id` 是 `week_key`。
- `reports[].id` 是 `weekly_reports.id`。
- `weekLabel/dateRange/shortDateRange` 不落库，由后端生成并在外层和 `report` 层展开填充，保持与当前前端一致。

### 7.3 PUT /api/weekly-reports/:weekKey

新建或覆盖保存一整周周报。

适合场景：

- 新建一周周报。
- 覆盖保存已有周报。
- Markdown 粘贴或 Markdown 文件导入。
- 前端编辑器一次性保存整周。
- 新增、删除、编辑、调整 report 顺序。
- 新增、删除、编辑、调整 item 顺序。

方式一：保存结构化 JSON。

```json
{
  "startDate": "2026-06-08",
  "endDate": "2026-06-12",
  "isPublished": false,
  "reports": [
    {
      "partLabel": "第一部分",
      "title": "小墨作文小游戏开发",
      "completed": [
        {
          "title": "完成文字翻翻卡核心玩法",
          "description": "",
          "images": []
        }
      ],
      "nextPlans": [
        {
          "title": "优化整体 UI",
          "description": "",
          "images": ["https://example.com/a.png"]
        }
      ]
    }
  ]
}
```

方式二：提交 Markdown 原文，由后端解析后保存。

```json
{
  "startDate": "2026-06-08",
  "endDate": "2026-06-12",
  "isPublished": false,
  "markdown": "## 第一部分｜小墨作文小游戏开发\n\n### 本周完成\n- 完成文字翻翻卡核心玩法\n\n### 未来展望\n- 优化整体 UI"
}
```

方式三：后续支持上传 Markdown 文件时，也走同一个接口，使用 `multipart/form-data`。

```http
PUT /api/weekly-reports/2026-W24
Content-Type: multipart/form-data

startDate=2026-06-08
endDate=2026-06-12
file=<weekly.md>
```

参数校验与请求边界：

| 规则 | 说明 |
| ---- | ---- |
| weekKey 来源 | 只从 URL path 读取；**body 不传 `weekKey`**，若 body 中出现 `weekKey` 字段，返回 `400` |
| 内容载体互斥 | `reports` 与 `markdown` / Markdown 文件**不能同时传**；同时传返回 `400` |
| 必须有内容 | 既没有 `reports`，也没有 `markdown` / 文件时，返回 `400` |
| 空周报 | `reports: []` **允许**，表示保存一个空周报（无 report 页） |
| 新建日期 | 新建周报时 `startDate`、`endDate` **必填** |
| 更新日期 | 更新已有周报时 `startDate`、`endDate` **可省略**，省略则沿用数据库原值 |
| 日期范围 | 若 `startDate`、`endDate` 同时传入，必须满足 `startDate <= endDate` |
| week_key 与日期 | 不要求 `weekKey` 与 `startDate/endDate` ISO 严格匹配；只校验 `week_key` 格式合法 |
| Markdown | 传 Markdown 原文或文件时，由**后端解析**为 reports/items，前端不做最终解析 |

Zod 请求体示例（结构化 JSON 场景）：

```typescript
const putWeeklyReportSchema = z
  .object({
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
    isPublished: z.boolean().optional(),
    reports: z.array(reportSchema).optional(),
    markdown: z.string().optional(),
  })
  .strict() // body 中出现 weekKey 等未声明字段时返回 400
  .refine((data) => !(data.reports !== undefined && data.markdown !== undefined), {
    message: 'reports 与 markdown 不能同时传',
  })
  .refine(
    (data) =>
      data.reports !== undefined || (data.markdown !== undefined && data.markdown.length > 0),
    { message: '必须提供 reports 或 markdown' },
  );
```

> 注：`reports: []` 时 `reports !== undefined` 为 true，满足「必须有内容载体」；空数组表示空周报。

服务端事务内执行：

1. 根据当前用户和 `weekKey` 查找这一周周报。
2. 如果不存在，则新建 `weekly_report_weeks`。
3. 如果已存在，则更新 week 元信息。
4. 如果请求里有 `reports`，直接使用结构化数据。
5. 如果请求里有 `markdown` 或 Markdown 文件，后端先解析成 reports/items。
6. 删除该 week 下所有旧 reports，级联删除 items。
7. 按最终 reports 数组顺序重建 reports/items。
8. 返回完整 `WeeklyReportWeek`。

说明：

- 这是“整周 upsert + 覆盖保存”语义：不存在就新建，存在就覆盖。
- `weekLabel/dateRange/shortDateRange` 是展示字段，不作为更新入参落库。
- Markdown 解析规则属于后端，前端只负责提交 Markdown 原文或文件。
- 新增/删除/编辑 report 或 item，都由前端先改完整周 JSON，再调用这个接口保存。
- 会导致原有 `weekly_reports.id` 和 `weekly_report_items.id` 变化，前端不应依赖这些 id 做长期业务标识。
- 如果未来需要稳定的条目 id、评论、历史版本或协同编辑，应改为更细粒度的 diff/update 方案。

### 7.4 DELETE /api/weekly-reports/:weekKey

删除整周。

后端：

- 校验该周属于当前用户。
- 删除 `weekly_report_weeks`。
- reports/items 通过外键级联删除。

响应可选：

```json
{
  "success": true
}
```

也可以返回 `204 No Content`。

### 7.5 POST /api/uploads/images

上传用户本地图片到后端，由后端存入自有 OSS，并返回可访问 URL。  
如果短期仍然只填 OSS 外链，可以先不做上传接口；一旦支持本地图片，就建议走这个接口统一入库。

请求：

```http
multipart/form-data
file=<image>
```

响应：

```json
{
  "success": true,
  "data": {
    "url": "https://cdn.example.com/weekly/xxx.png"
  }
}
```

说明：

- 图片文件本身不存数据库。
- 数据库存 `weekly_report_items.images`，MVP 只存 URL 字符串数组。
- 接口层须用 Zod 校验：`images: z.array(z.string().url()).default([])`。
- 后端负责文件类型、大小、权限、OSS 路径和返回 URL。

### 7.6 GET /api/public/users/:username/weekly-reports/:weekKey

公开展示接口。

规则：

- 不需要登录。
- 路径中的 `:username` 对应 `User.username`（当前与 email 相同）。
- 必须带用户维度，因为 `week_key` 只在同一用户下唯一，不是全局唯一。
- 公开访问必须**同时满足**以下两个条件：
  1. 用户 `public_weekly_reports_enabled = true`（用户级总开关）
  2. 该周报 `is_published = true`（单篇发布开关）
- 任一条件不满足，统一返回 `404`，避免泄露周报是否存在。

查询逻辑示例：

```sql
SELECT w.*
FROM weekly_report_weeks w
JOIN "User" u ON u.id = w.user_id
WHERE u.username = $1
  AND w.week_key = $2
  AND u.public_weekly_reports_enabled = true
  AND w.is_published = true;
```

示例：

```http
GET /api/public/users/test@example.com/weekly-reports/2026-W24
```

响应结构与 `GET /api/weekly-reports/:weekKey` 一致，但不返回敏感字段。

### 7.7 私密分享（二期）

MVP 不建 `share_token` 字段，不实现该接口。  
二期可增加：

```
GET /api/share/weekly-reports/:shareToken
```

规则（二期设计参考）：

- 不需要登录。
- 根据 `share_token` 查找周报。
- 可以不要求 `is_published = true`，因为 token 本身就是访问凭证。
- `share_token` 应使用高随机性字符串，避免被猜中。

## 8. 错误码约定

| 状态码 | 场景                                                       |
| ------ | ---------------------------------------------------------- |
| 400    | 参数校验失败：body 传 `weekKey`、`reports` 与 `markdown` 同时传、既无 `reports` 也无 `markdown`/文件、新建时缺少 `startDate/endDate`、`startDate > endDate`、`week_key` 格式非法、`images` 非 URL 字符串数组、Markdown 解析失败。 |
| 401    | 未登录或 token 无效。                                      |
| 403    | 已登录，但无权限操作该资源。                               |
| 404    | weekKey 不存在、未公开、或为了安全隐藏无权限资源。         |
| 409    | 并发写入冲突等少数需要显式提示的冲突场景。MVP 通常不需要。 |
| 500    | 服务端异常。                                               |

MVP 推荐：

- 鉴权失败返回 `401`。
- 资源不存在、不属于当前用户、或未满足公开双开关时，统一返回 `404`。
- `PUT /api/weekly-reports/:weekKey` 是 upsert：同一周已存在就覆盖保存，不返回重复创建错误。

## 9. 前端场景映射

| 前端场景                | 推荐 API                                                     |
| ----------------------- | ------------------------------------------------------------ |
| 展示页切换周            | `GET /api/weekly-reports` + `GET /api/weekly-reports/:weekKey` |
| 工作台新建一周          | `PUT /api/weekly-reports/:weekKey`                           |
| 编辑某一页内容          | 前端修改整周 JSON 后，调用 `PUT /api/weekly-reports/:weekKey` |
| 新增/删除某一页         | 前端修改整周 JSON 后，调用 `PUT /api/weekly-reports/:weekKey` |
| 调整 report 顺序        | 前端调整 reports 数组顺序后，调用 `PUT /api/weekly-reports/:weekKey` |
| 整周保存                | `PUT /api/weekly-reports/:weekKey`                           |
| 删除整周                | `DELETE /api/weekly-reports/:weekKey`                        |
| Markdown 粘贴或文件导入 | 前端提交 Markdown 原文/文件到 `PUT /api/weekly-reports/:weekKey`，后端解析并保存 |
| 条目旁上传图片          | `POST /api/uploads/images`，再把 URL 写入 item               |
| 公开展示                | `GET /api/public/users/:username/weekly-reports/:weekKey`    |
| 开启用户级公开开关      | 用户设置页更新 `public_weekly_reports_enabled`（待定义设置接口） |
| 发布单篇周报            | `PUT /api/weekly-reports/:weekKey` 中设置 `isPublished: true` |
| 私密分享                | 二期：`GET /api/share/weekly-reports/:shareToken`            |

## 10. MVP 实施建议

第一阶段建议只做：

1. `User` 表新增 `public_weekly_reports_enabled` 字段。
2. 三张核心表：`weekly_report_weeks`、`weekly_reports`、`weekly_report_items`。
3. Prisma `createdAt @default(now())` + `updatedAt @updatedAt`，不使用数据库 trigger。
4. 基础 CHECK 约束：`week_key` 格式、`start_date <= end_date`、`images` 为 JSON 数组等。
5. 接口层 Zod 校验：`images` 为 URL 字符串数组；PUT 请求边界（weekKey 来源、互斥规则、空周报、新建/更新日期规则）。
6. 登录用户自己的整周 CRUD。
7. `PUT /api/weekly-reports/:weekKey` 负责新建、覆盖保存、Markdown 解析导入。
8. 公开展示接口 `GET /api/public/users/:username/weekly-reports/:weekKey`，校验用户级与单篇双开关。
9. 如果首版支持本地图片，则实现图片上传到自有 OSS，并把 URL 写入周报 item。

第二阶段再做：

1. 私密分享 `share_token` 字段与 `/api/share/weekly-reports/:shareToken` 接口。
2. 用户公开开关的设置接口（若 MVP 未做）。
3. 导入日志。
4. 历史版本或回滚。
5. 图片资源管理，例如删除未使用图片、替换图片、图片访问权限控制。

## 11. 最终结论

这套设计适合作为 Weekly Lab 周报功能的 MVP 数据库与接口基础。

核心取舍是：

- 不在 `weekly_reports` 冗余 `user_id`，通过父级 week 判断归属。
- 外键类型与现有 `User.id`（`Int`）保持一致。
- `week_key` 格式固定为 `YYYY-W01` ~ `YYYY-W53`，作为前端周业务 id；不强制 ISO 周推导日期；`start_date/end_date` 是实际展示日期。
- report 和 item 都用 `sort_order` 保存展示顺序。
- MVP 对外只暴露整周 CRUD，新增/删除/编辑 report 或 item 都通过 `PUT /api/weekly-reports/:weekKey` 完成。
- PUT 边界明确：weekKey 只来自 path、reports/markdown 互斥、允许空周报、新建/更新日期规则分离。
- Markdown 解析规则放在后端，前端只提交 Markdown 原文/文件或结构化 JSON。
- `images` 数据库层校验 JSON 数组，接口层 Zod 校验 URL 字符串数组。
- 本地图片通过后端上传到自有 OSS，数据库只保存图片 URL。
- `createdAt` / `updatedAt` 统一用 Prisma `@default(now())` / `@updatedAt`，不维护数据库 trigger。
- 公开分享采用双开关：`User.public_weekly_reports_enabled` + `weekly_report_weeks.is_published`。
- 公开路径使用 `username`（当前即 email，`email` 已唯一）；不使用 `public_slug`。
- `share_token` 私密分享作为二期能力，不纳入 MVP 核心建表。

只要后续确认 Markdown 解析规则、OSS 存储配置和用户公开开关的设置方式，就可以进入建表和接口实现阶段。
