# 前端接口需求（简版）

## 说明

本文档只整理小程序和 H5 前端需要调用的接口。

美食和地点由当前 H5、小程序中的新建页面录入，不再单独依赖后台管理页面。

## 图片建议

美食和地点图片建议上传到 OSS，并通过 CDN 域名访问。数据库只保存图片地址或 OSS `objectKey`，不保存图片二进制内容。

接口给前端返回可直接展示的 `image` URL。后续可以根据使用场景返回缩略图，避免列表页加载原图。

新建内容时，前端通过 `multipart/form-data` 一次提交文本和图片。后端负责校验图片、上传 OSS，并将图片 URL 和内容写入数据库。

## 1. 美食列表

```http
GET /api/crush-date/foods?page=1&pageSize=20
```

```json
{
  "list": [
    {
      "id": "food-01",
      "name": "阿里郎朝鲜烤肉",
      "type": "烤肉 · 朝鲜风味",
      "comment": "感受一下当太阳的感觉！",
      "image": "https://cdn.example.com/foods/food-01.webp",
      "visited": true,
      "visitedAt": "2026-07-15T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

## 2. 出去玩的地点列表

```http
GET /api/crush-date/places?page=1&pageSize=20
```

```json
{
  "list": [
    {
      "id": "place-01",
      "name": "颐和园傍晚散步",
      "type": "公园 · 散步",
      "comment": "想慢慢走完长廊，再看一眼湖面。",
      "image": "https://cdn.example.com/places/place-01.webp",
      "visited": false,
      "visitedAt": null
    }
  ],
  "total": 1
}
```

## 3. 新增美食或地点

美食和地点共用一个接口，通过 `contentType` 区分类型。

```http
POST /api/crush-date/content-items
Content-Type: multipart/form-data
```

表单字段：

- `file`：必填，JPG、PNG 或 WebP，最大 5MB。
- `contentType`：必填，取值为 `food | place`。
- `name`：必填。
- `type`：必填。
- `comment`：必填，允许空字符串。

前端调用示例：

```ts
const formData = new FormData();
formData.append('file', file);
formData.append('contentType', 'food');
formData.append('name', '阿里郎朝鲜烤肉');
formData.append('type', '烤肉 · 朝鲜风味');
formData.append('comment', '想一起去感受一下当太阳的感觉！');

await fetch('/api/crush-date/content-items', {
  method: 'POST',
  body: formData,
});
```

返回新建后的完整数据：

```json
{
  "id": "food-13",
  "contentType": "food",
  "name": "阿里郎朝鲜烤肉",
  "type": "烤肉 · 朝鲜风味",
  "comment": "想一起去感受一下当太阳的感觉！",
  "image": "https://cdn.example.com/foods/food-new.webp",
  "visited": false,
  "visitedAt": null
}
```

数据库写入失败时，后端会尝试删除本次已上传的 OSS 图片，避免产生孤儿文件。

## 4. 删除美食或地点

当前不提供修改功能，但允许按内容 ID 删除美食或地点。

```http
DELETE /api/crush-date/content-items/{id}
```

删除成功返回 `204 No Content`。记录不存在返回 `404 Not Found`。

删除数据库记录后，如果图片属于本项目 OSS，后端会尽力同步删除 OSS 文件；外部图片 URL 不会被删除。

## 5. 标记吃过或去过

美食和地点共用一个接口，通过 `visited` 同时支持标记和撤销标记。

```http
PATCH /api/crush-date/content-items/{id}/visited
Content-Type: application/json
```

标记为吃过或去过：

```json
{
  "visited": true
}
```

撤销标记：

```json
{
  "visited": false
}
```

成功返回 `200 OK` 和更新后的完整内容：

```json
{
  "id": "food-01",
  "contentType": "food",
  "name": "阿里郎朝鲜烤肉",
  "type": "烤肉 · 朝鲜风味",
  "comment": "感受一下当太阳的感觉！",
  "image": "https://cdn.example.com/foods/food-01.webp",
  "visited": true,
  "visitedAt": "2026-07-15T12:00:00.000Z"
}
```

字段与业务规则：

- `visited` 必填且必须是布尔值。
- `visited = true` 时，后端使用服务器当前时间写入 `visitedAt`。
- `visited = false` 时，后端将 `visitedAt` 清空为 `null`。
- 重复提交当前状态属于幂等操作，仍返回 `200 OK`；重复标记时保留原 `visitedAt`，不刷新时间。
- 内容不存在返回 `404 Not Found`。
- `visitedAt` 使用 ISO 8601 UTC 时间；前端负责按本地时区格式化展示。

美食列表、地点列表和新增内容接口都必须返回 `visited`、`visitedAt`。新建内容默认
`visited = false`、`visitedAt = null`。列表仍按内容创建时间倒序，不因标记时间改变排序。

## 6. 计划数据结构

所有计划接口统一使用 `status` 字段，不再使用 `planType`。

- `status`：`active | backup | completed`，分别表示本次计划、备用计划、过去的计划。
- `scenario`：`hot | cold | rainy | sunny | free`。
- `period`：`morning | noon | afternoon | evening`。
- `date`：格式为 `YYYY-MM-DD`，按业务时区 `Asia/Shanghai` 校验。

完整的计划响应结构如下：

```json
{
  "id": "plan-01",
  "title": "下雨的时候",
  "status": "backup",
  "date": null,
  "scenario": "rainy",
  "scenarioText": "下雨 · 室内",
  "note": "下雨就找个室内的地方慢慢逛。",
  "items": [
    {
      "id": "plan-item-01",
      "type": "place",
      "sourceId": "place-01",
      "title": "博物馆慢慢逛",
      "image": "https://cdn.example.com/places/place-01.webp",
      "period": "afternoon",
      "note": "先在室内慢慢看展。",
      "order": 0
    }
  ],
  "sourceBackupId": null,
  "completedAt": null,
  "createdAt": "2026-07-15T04:00:00.000Z",
  "updatedAt": "2026-07-15T04:00:00.000Z"
}
```

安排项写入时只提交 `type`、`sourceId`、`period`、`note` 和 `order`。`id` 由后端生成，
`title` 和 `image` 由后端根据 `sourceId` 查询美食或地点并保存快照，不能由前端覆盖。这样原始
美食或地点被删除后，已有计划仍能正常展示，删除内容时不级联删除计划安排。

同一计划中 `sourceId` 不能重复。后端按每个 `period` 内的 `order` 排序，并在写入后将顺序
整理为从 `0` 开始的连续数字。

过去计划精选照片使用独立数据表，不放入计划列表和计划详情响应：

```prisma
model CrushDatePlanPhoto {
  id        String        @id
  planId    String        @map("plan_id")
  objectKey String        @unique @map("object_key")
  sortOrder Int           @map("sort_order")
  createdAt DateTime      @default(now()) @map("created_at")

  plan      CrushDatePlan @relation(
    fields: [planId],
    references: [id],
    onDelete: Cascade
  )

  @@index([planId, sortOrder, createdAt])
  @@map("crush_date_plan_photos")
}
```

`CrushDatePlan` 通过 `photos CrushDatePlanPhoto[]` 建立关联。删除计划时数据库级联删除照片
记录；数据库只保存 OSS `objectKey`，公开 URL 在响应时动态生成。`sortOrder` 为手动排序
字段。

## 7. 新增计划

```http
POST /api/crush-date/plans
Content-Type: application/json
```

```json
{
  "title": "下雨的时候",
  "status": "backup",
  "date": null,
  "scenario": "rainy",
  "scenarioText": "下雨 · 室内",
  "note": "下雨就找个室内的地方慢慢逛。",
  "items": [
    {
      "type": "place",
      "sourceId": "place-01",
      "period": "afternoon",
      "note": "先在室内慢慢看展。",
      "order": 0
    }
  ]
}
```

创建时只接受 `active` 或 `backup`：

- `active`：`date` 必填，且不能早于当前业务日期；系统中不能已有本次计划。
- `backup`：`date` 必须为 `null`。
- `completed`：不能直接创建，只能通过完成本次计划产生。

创建成功返回完整计划和 `201 Created`。

## 8. 计划列表

```http
GET /api/crush-date/plans
```

为了方便前端直接渲染，固定按三种状态分组返回：

```json
{
  "activePlan": {
    "id": "plan-active-01",
    "title": "周日去约会",
    "status": "active",
    "date": "2026-07-19",
    "scenario": "sunny",
    "scenarioText": "晴天",
    "note": "",
    "items": [],
    "sourceBackupId": null,
    "completedAt": null,
    "createdAt": "2026-07-15T04:00:00.000Z",
    "updatedAt": "2026-07-15T04:00:00.000Z"
  },
  "backupPlans": [],
  "completedPlans": []
}
```

没有本次计划时 `activePlan` 返回 `null`。`backupPlans` 按 `createdAt` 倒序，
`completedPlans` 按 `completedAt` 倒序。当前数据量较小，列表暂不分页。

## 9. 获取计划详情

```http
GET /api/crush-date/plans/{id}
```

成功返回完整计划和 `200 OK`；计划不存在返回 `404 Not Found`。

## 10. 修改计划

```http
PATCH /api/crush-date/plans/{id}
Content-Type: application/json
```

可以修改 `title`、`date`、`scenario`、`scenarioText`、`note` 和 `items`，不能通过该接口修改
`status`。过去的计划为只读，不能修改。

`items` 使用完整替换语义：

- 不传 `items`：保留原有安排。
- 传入 `items`：请求数组代表修改后的全部安排。
- 带已有 `id` 的安排表示更新；不带 `id` 的安排表示新增。
- 原有安排未出现在请求数组中表示删除。
- 已有安排修改 `sourceId` 时，后端重新生成 `title` 和 `image` 快照。

```json
{
  "title": "下雨天备用计划",
  "items": [
    {
      "id": "plan-item-01",
      "type": "place",
      "sourceId": "place-01",
      "period": "afternoon",
      "note": "慢慢看展。",
      "order": 0
    },
    {
      "type": "food",
      "sourceId": "food-01",
      "period": "evening",
      "note": "看完展去吃饭。",
      "order": 0
    }
  ]
}
```

计划和安排项必须在同一个数据库事务中更新。成功返回修改后的完整计划和 `200 OK`。

## 11. 删除计划

```http
DELETE /api/crush-date/plans/{id}
```

允许删除本次计划、备用计划或过去的计划。删除前读取计划精选照片的 `objectKey`，在数据库
事务中删除计划；安排项和精选照片记录通过外键级联删除。数据库成功后清理 OSS 中对应的精选
照片，清理失败只记录日志，不让计划删除失败。删除成功返回 `204 No Content`；计划不存在
返回 `404 Not Found`。不得删除美食、地点或安排快照引用的原始图片。

## 12. 更新计划状态

```http
PATCH /api/crush-date/plans/{id}/status
Content-Type: application/json
```

备用计划设为本次计划：

```json
{
  "status": "active",
  "date": "2026-07-26"
}
```

完成本次计划：

```json
{
  "status": "completed"
}
```

本次计划放回备用计划：

```json
{
  "status": "backup"
}
```

只允许 `backup → active`、`active → backup` 和 `active → completed`。激活时 `date`
必填，后端将 `sourceBackupId` 设为 `null`；放回备用时不能提交 `date`，后端将 `date`、
`completedAt` 和 `sourceBackupId` 设为 `null`；完成时由服务器写入 `completedAt`。所有
流转均直接更新原计划，计划 ID、安排项 ID、内容和创建时间保持不变，成功返回完整计划和
`200 OK`。计划不存在返回 `404`，状态不允许或已有本次计划返回 `409`，请求字段不合法返回
`400`。

原 `POST /plans/{id}/activate` 和 `POST /plans/{id}/complete` 路由删除。

## 13. 过去计划再计划一次

```http
POST /api/crush-date/plans/{id}/replan
Content-Type: application/json
```

```json
{
  "date": "2026-07-26"
}
```

源计划必须是过去的计划，并且系统中不能已有本次计划。接口创建一份新的本次计划，保留原过去
计划；新计划和安排项使用新的 ID。成功返回新计划和 `201 Created`。

## 14. 上传过去计划精选照片

```http
POST /api/crush-date/plans/{planId}/photos
Content-Type: multipart/form-data
```

表单字段为 `file`，每次上传一张。仅过去的计划允许上传，支持 JPG、PNG、WebP，单张最大
5MB，每个计划最多 9 张。后端生成照片 ID，并按以下路径上传：

```text
crush-date/plan-photos/{planId}/{photoId}.{ext}
```

数据库只保存 `objectKey`，响应时动态生成 OSS URL。照片自动追加连续 `sortOrder`。数据库
写入失败时必须清理刚上传的 OSS 文件。成功返回照片 ID、URL、顺序、创建时间和
`201 Created`。

## 15. 查询过去计划精选照片

```http
GET /api/crush-date/plans/{planId}/photos
```

仅过去的计划允许查询。照片不加入计划列表或详情响应，由过去计划详情页单独请求。返回顺序为：

```text
sortOrder ASC, createdAt ASC, id ASC
```

成功返回 `{ "list": [...] }` 和 `200 OK`。

## 16. 调整过去计划精选照片顺序

```http
PATCH /api/crush-date/plans/{planId}/photos/order
Content-Type: application/json
```

```json
{
  "photoIds": ["photo-3", "photo-1", "photo-2"]
}
```

`photoIds` 必须无重复并完整包含该计划当前的全部照片，不允许缺少、增加或混入其他计划的照片
ID。后端在事务中按数组顺序重新写入从 `0` 开始的连续 `sortOrder`，成功返回排序后的完整照片
列表和 `200 OK`。

## 17. 删除单张过去计划精选照片

```http
DELETE /api/crush-date/plans/{planId}/photos/{photoId}
```

仅过去的计划允许删除精选照片。事务内锁定所属计划，校验照片属于该计划，删除照片记录，并将
剩余照片按照 `sortOrder ASC, createdAt ASC, id ASC` 的当前顺序重新写入从 `0` 开始的连续
`sortOrder`。

数据库删除成功后清理该照片对应的 OSS 文件。OSS 清理失败只记录日志，不将已经成功的数据库
删除改成失败。成功返回 `204 No Content`；计划或照片不存在、照片不属于该计划返回
`404 Not Found`；计划不是过去计划返回 `409 Conflict`。

删除整个计划时仍然级联删除该计划全部照片记录，并在数据库成功后清理全部对应 OSS 文件。

前端接入约定：

- 仅在 `completedPlans` 的详情页展示精选照片入口。
- 进入详情页后单独调用照片查询接口，不从计划列表或计划详情对象读取照片。
- 多选图片后逐张调用上传接口；上传成功后刷新照片列表。
- 排序时必须提交当前计划全部照片 ID，数组顺序就是最终展示顺序。
- 删除单张照片后重新查询照片列表，以后端重排后的 `sortOrder` 为准。
- `active`、`backup`、`completed` 三类计划均可调用现有计划删除接口；删除
  `completed` 计划前应提示精选照片也会被永久删除。

## 18. 业务约束与状态码

在当前没有登录和用户体系的阶段，整个 Crush Date 数据集最多只能有一条 `active` 计划。
后端必须通过数据库唯一约束或事务锁保证该规则，不能只依赖前端判断。以后增加用户或情侣关系后，
唯一约束需要改为在对应用户或情侣范围内生效。

| 状态码 | 使用场景 |
| ------ | -------- |
| `200 OK` | 查询、修改、计划状态流转成功 |
| `201 Created` | 新增计划、再次计划、上传精选照片成功 |
| `204 No Content` | 删除成功 |
| `400 Bad Request` | 字段、日期、枚举值或安排数据不合法 |
| `404 Not Found` | 计划或引用的美食、地点不存在 |
| `409 Conflict` | 已有本次计划、计划状态不允许当前操作、修改只读的过去计划、非过去计划管理照片或照片达到 9 张 |

所有会同时写入计划和安排项的操作必须使用数据库事务。更新计划状态和再次计划接口需要校验
源状态；同一个请求因重复提交造成状态不满足时返回 `409 Conflict`。

## 暂时不写的内容

- OSS 签名上传接口。
- 登录和用户体系。
- 回忆文字和分享接口。
- 跨服务的分布式事务方案。
