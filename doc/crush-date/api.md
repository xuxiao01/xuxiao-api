# Crush Date 接口文档

本地联调基础地址：

```text
http://localhost:3000
```

Crush Date 接口当前无需登录或 Authorization Header。

## 美食列表

```http
GET /api/crush-date/foods?page=1&pageSize=20
```

`page` 默认 `1`；`pageSize` 默认 `20`，最大 `100`。列表按创建时间倒序返回。

```json
{
  "list": [
    {
      "id": "food-550e8400-e29b-41d4-a716-446655440000",
      "name": "阿里郎朝鲜烤肉",
      "type": "烤肉 · 朝鲜风味",
      "comment": "想一起去吃！",
      "image": "https://cdn.example.com/foods/food-01.webp",
      "visited": true,
      "visitedAt": "2026-07-15T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

## 出去玩的地点列表

```http
GET /api/crush-date/places?page=1&pageSize=20
```

分页规则及响应结构与美食列表一致，列表中只返回 `contentType = place` 的数据。

## 新增美食或地点

该接口无需登录，一次提交文本内容和图片。采用 `multipart/form-data`，图片支持 JPG、PNG 和 WebP，单张最大 5MB。

```http
POST /api/crush-date/content-items
Content-Type: multipart/form-data
```

表单字段：

- `file`：必填，图片文件。
- `contentType`：必填，仅支持 `food` 或 `place`。
- `name`：必填，不能只包含空白字符。
- `type`：必填，不能只包含空白字符。
- `comment`：必填，允许空字符串。

成功时返回 `201 Created`：

```json
{
  "id": "food-550e8400-e29b-41d4-a716-446655440000",
  "contentType": "food",
  "name": "阿里郎朝鲜烤肉",
  "type": "烤肉 · 朝鲜风味",
  "comment": "想一起去感受一下当太阳的感觉！",
  "image": "https://xuxiao-cursh-date-images.oss-cn-beijing.aliyuncs.com/crush-date/foods/2026/07/uuid.webp",
  "visited": false,
  "visitedAt": null
}
```

服务端会检查声明的 MIME 类型和实际文件签名，然后上传 OSS 并写入数据库。如果数据库写入失败，会尝试删除刚上传的 OSS 图片。

## 删除美食或地点

美食和地点共用删除接口，使用列表或新增接口返回的 `id`。

```http
DELETE /api/crush-date/content-items/{id}
```

请求示例：

```http
DELETE http://localhost:3000/api/crush-date/content-items/food-550e8400-e29b-41d4-a716-446655440000
```

该接口不需要 Query 参数和请求体。

首次成功删除返回 `204 No Content`，无响应体。Apifox 中应以 HTTP 状态码 `204` 判断删除成功，不要等待 JSON 响应。

同一个 ID 再次删除时，因为数据库记录已被第一次请求删除，会返回 `404 Not Found`：

```http
404 Not Found
```

```json
{
  "success": false,
  "message": "美食或地点不存在"
}
```

因此，如果 Apifox 显示“美食或地点不存在”，同时列表中已经没有该记录，通常说明同一个删除请求被发送了两次。可以在 Apifox 的实际请求或控制台中检查请求次数。

Apifox 联调步骤：

1. 先调用美食或地点列表接口，复制一条真实存在的 `id`。
2. 新建 `DELETE` 请求，将 `id` 拼接到 `/api/crush-date/content-items/{id}`。
3. 不配置 Params、Body 和 Authorization，点击一次“发送”。
4. 确认首次响应状态码为 `204`。
5. 重新调用对应列表接口，确认该记录已经消失。

也可以使用 cURL：

```bash
curl -i -X DELETE \
  'http://localhost:3000/api/crush-date/content-items/food-550e8400-e29b-41d4-a716-446655440000'
```

数据库记录删除成功后，如果 `image` 是本项目 OSS 地址，服务端会尝试同步删除图片。外部图片 URL 不会被删除。当前不提供修改接口。

## 标记吃过或去过

美食和地点共用该接口，同时支持标记和撤销。

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
  "id": "food-550e8400-e29b-41d4-a716-446655440000",
  "contentType": "food",
  "name": "阿里郎朝鲜烤肉",
  "type": "烤肉 · 朝鲜风味",
  "comment": "想一起去吃！",
  "image": "https://cdn.example.com/foods/food-01.webp",
  "visited": true,
  "visitedAt": "2026-07-15T12:00:00.000Z"
}
```

业务规则：

- `visited` 必填且必须是布尔值。
- 从未标记变为 `true` 时，后端使用服务器当前时间写入 `visitedAt`。
- 重复提交 `true` 是幂等操作，保留原 `visitedAt`，不会刷新时间。
- 提交 `false` 时清空 `visitedAt`；重复撤销同样返回成功。
- 内容不存在返回 `404 Not Found`。
- `visitedAt` 返回 ISO 8601 UTC 时间，前端负责转换为本地时间。

美食列表、地点列表和新增内容响应都会返回 `visited`、`visitedAt`。新建内容默认为 `false` 和 `null`；列表仍按内容创建时间倒序，不按标记时间重新排序。

## 新增计划

创建本次计划或备用计划。当前不能直接创建过去计划。

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
      "sourceId": "place-550e8400-e29b-41d4-a716-446655440000",
      "period": "afternoon",
      "note": "先在室内慢慢看展。",
      "order": 0
    }
  ]
}
```

字段规则：

- `status`：仅支持 `active` 或 `backup`。
- `active`：`date` 必填，格式为 `YYYY-MM-DD`，不能早于上海时区的当前日期；系统中最多存在一条。
- `backup`：`date` 必须为 `null`。
- `scenario`：支持 `hot`、`cold`、`rainy`、`sunny`、`free`。
- `period`：支持 `morning`、`noon`、`afternoon`、`evening`。
- `sourceId`：必须是现有美食或地点 ID，且要与 `type` 匹配；同一计划中不能重复。
- `order`：大于等于 `0` 的整数。后端按每个 `period` 内的顺序整理为从 `0` 开始的连续数字。

安排项的 `id` 由后端生成，`title` 和 `image` 根据 `sourceId` 保存快照，前端不能提交或覆盖。

成功返回 `201 Created` 和完整计划。系统中已有本次计划时，再创建 `active` 返回：

```http
409 Conflict
```

```json
{
  "success": false,
  "message": "系统中已存在本次计划"
}
```

## 计划列表

```http
GET /api/crush-date/plans
```

当前数据量较小，暂不分页。响应固定按照三种状态分组：

```json
{
  "activePlan": null,
  "backupPlans": [
    {
      "id": "plan-550e8400-e29b-41d4-a716-446655440000",
      "title": "下雨的时候",
      "status": "backup",
      "date": null,
      "scenario": "rainy",
      "scenarioText": "下雨 · 室内",
      "note": "下雨就找个室内的地方慢慢逛。",
      "items": [],
      "sourceBackupId": null,
      "completedAt": null,
      "createdAt": "2026-07-15T04:00:00.000Z",
      "updatedAt": "2026-07-15T04:00:00.000Z"
    }
  ],
  "completedPlans": []
}
```

没有本次计划时 `activePlan` 为 `null`；`backupPlans` 按创建时间倒序，`completedPlans` 按完成时间倒序。安排项按照 `morning → noon → afternoon → evening` 和 `order` 排序。

## 获取计划详情

```http
GET /api/crush-date/plans/{id}
```

使用计划列表或新增计划接口返回的计划 `id`。成功返回 `200 OK` 和完整计划；计划不存在返回：

```http
404 Not Found
```

```json
{
  "success": false,
  "message": "计划不存在"
}
```

## 修改计划

```http
PATCH /api/crush-date/plans/{id}
Content-Type: application/json
```

支持修改 `title`、`date`、`scenario`、`scenarioText`、`note` 和 `items`，至少需要提交一个字段。不能通过该接口修改 `status`，`completed` 计划只读。

只修改普通字段：

```json
{
  "title": "下雨天备用计划",
  "note": "记得提前预约。"
}
```

修改安排项：

```json
{
  "items": [
    {
      "id": "plan-item-550e8400-e29b-41d4-a716-446655440000",
      "type": "place",
      "sourceId": "place-550e8400-e29b-41d4-a716-446655440000",
      "period": "afternoon",
      "note": "慢慢看展。",
      "order": 0
    },
    {
      "type": "food",
      "sourceId": "food-550e8400-e29b-41d4-a716-446655440000",
      "period": "evening",
      "note": "看完展去吃饭。",
      "order": 0
    }
  ]
}
```

`items` 使用完整替换语义：

- 不提交 `items`：保留原有全部安排。
- 提交 `items`：请求数组就是修改后的全部安排。
- 带当前计划已有安排 `id`：保留该 ID 并更新安排。
- 不带 `id`：新增安排，由后端生成 ID。
- 原有安排未出现在数组中：删除该安排。
- 已有安排更换 `sourceId`：重新读取美食或地点并保存标题、图片快照。
- 已有安排未更换来源：即使原始美食或地点已删除，仍保留原快照并允许修改时间段、备注和顺序。

计划与安排项在同一个数据库事务中更新。成功返回 `200 OK` 和修改后的完整计划。过去计划尝试修改时返回 `409 Conflict`。

## 删除计划

```http
DELETE /api/crush-date/plans/{id}
```

允许删除 `active`、`backup` 或 `completed` 计划。关联的安排项和精选照片数据库记录会通过外键级联删除。

- 删除成功：`204 No Content`，无响应体。
- 计划不存在：`404 Not Found`。

数据库删除成功后，后端会清理该计划精选照片对应的 OSS 文件。OSS 清理失败只记录日志，不会将已经成功的计划删除改成失败。

删除计划不会删除美食、地点、安排快照引用的原始图片或其他计划的图片。

## 更新计划状态

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

接口仅允许以下状态流转：

```text
backup → active
active → backup
active → completed
```

从 `backup` 更新为 `active` 时，`date` 必填，必须是有效的 `YYYY-MM-DD`，且不能早于上海时区的当前日期；系统中不能已有其他 `active` 计划。
从 `active` 更新为 `backup` 时不能提交 `date`，后端会将原计划日期清空。

状态流转会直接更新原计划：

- 计划 ID、安排项 ID、标题、场景、备注、安排快照和创建时间保持不变。
- 激活时将 `sourceBackupId` 设为 `null`，不会额外保留内容相同的备用计划。
- 放回备用计划时将 `date`、`completedAt` 和 `sourceBackupId` 设为 `null`。
- 完成时由服务器写入 `completedAt`。
- 成功返回 `200 OK` 和更新后的完整计划。

计划不存在返回 `404 Not Found`；不允许的源状态、重复提交或系统中已有本次计划时返回
`409 Conflict`。请求字段不符合对应目标状态的要求时返回 `400 Bad Request`。

以下旧接口已移除，前端和 Apifox 中不再使用：

```http
POST /api/crush-date/plans/{id}/activate
POST /api/crush-date/plans/{id}/complete
```

## 过去计划再计划一次

```http
POST /api/crush-date/plans/{id}/replan
Content-Type: application/json
```

```json
{
  "date": "2026-07-26"
}
```

`date` 必须是有效的 `YYYY-MM-DD`，且不能早于上海时区的当前日期。源计划必须是 `completed`，系统中不能已有 `active` 计划。

接口会保留原过去计划，并复制生成一条新的本次计划：

- 新计划及全部安排项使用新的 ID。
- 标题、场景、备注和安排快照从过去计划复制。
- 新计划的 `sourceBackupId` 为 `null`。
- 创建成功返回 `201 Created` 和完整的新计划。

源计划不是过去计划，或者系统中已有本次计划时返回 `409 Conflict`。

## 上传过去计划精选照片

```http
POST /api/crush-date/plans/{planId}/photos
Content-Type: multipart/form-data
```

仅 `completed` 计划允许上传。Apifox 的 Body 选择 `form-data`，添加名称为 `file` 的字段，
字段类型选择文件并选中一张图片。

- 支持 JPG、PNG、WebP。
- 单张最大 5MB。
- 每次请求上传一张，前端多选时逐张调用。
- 每个计划最多 9 张。
- 后端自动追加连续的 `sortOrder`。

OSS 对象路径为：

```text
crush-date/plan-photos/{planId}/{photoId}.{ext}
```

数据库只保存 `objectKey`，响应中的 `url` 由后端动态生成。成功返回 `201 Created`：

```json
{
  "id": "photo-2ae94f5d-9d10-46ef-a93c-cf0c37c3ab0f",
  "url": "https://example.oss-cn-beijing.aliyuncs.com/crush-date/plan-photos/plan-01/photo-2ae94f5d-9d10-46ef-a93c-cf0c37c3ab0f.webp",
  "sortOrder": 0,
  "createdAt": "2026-07-24T08:30:00.000Z"
}
```

计划不存在返回 `404 Not Found`；计划不是 `completed` 或已经有 9 张照片时返回
`409 Conflict`；缺少文件、格式错误或超过 5MB 时返回 `400 Bad Request`。OSS 上传成功但
数据库写入失败时，后端会清理刚上传的 OSS 文件。

## 查询过去计划精选照片

```http
GET /api/crush-date/plans/{planId}/photos
```

照片不放入计划列表或计划详情响应，进入过去计划详情页后单独查询。仅 `completed` 计划允许
查询，返回顺序为 `sortOrder ASC`、`createdAt ASC`、`id ASC`。

```json
{
  "list": [
    {
      "id": "photo-01",
      "url": "https://example.oss-cn-beijing.aliyuncs.com/crush-date/plan-photos/plan-01/photo-01.webp",
      "sortOrder": 0,
      "createdAt": "2026-07-24T08:30:00.000Z"
    }
  ]
}
```

成功返回 `200 OK`；计划不存在返回 `404 Not Found`；计划不是 `completed` 返回
`409 Conflict`。

## 调整过去计划精选照片顺序

```http
PATCH /api/crush-date/plans/{planId}/photos/order
Content-Type: application/json
```

```json
{
  "photoIds": [
    "photo-03",
    "photo-01",
    "photo-02"
  ]
}
```

`photoIds` 必须无重复并完整包含该计划当前的全部照片，不能缺少、增加或混入其他计划的照片
ID。后端在事务中按照数组顺序重新写入从 `0` 开始的连续 `sortOrder`。

成功返回 `200 OK`，响应结构与查询照片接口一致，`list` 已按新顺序排列。计划不存在返回
`404 Not Found`；计划不是 `completed` 返回 `409 Conflict`；数组重复或没有完整包含全部
照片时返回 `400 Bad Request`。

## 删除单张过去计划精选照片

```http
DELETE /api/crush-date/plans/{planId}/photos/{photoId}
```

仅 `completed` 计划允许删除精选照片。照片必须属于 URL 中指定的计划，不能使用一个计划 ID
删除另一个计划的照片。

数据库事务会删除照片记录，并将剩余照片的 `sortOrder` 按当前展示顺序重新整理为从 `0`
开始的连续数字。数据库成功后清理对应的 OSS 文件；OSS 清理失败只记录日志，不会将已经成功
的数据库删除改成失败。

- 删除成功：`204 No Content`，无响应体。
- 计划或照片不存在、照片不属于该计划：`404 Not Found`。
- 计划不是 `completed`：`409 Conflict`。

删除整个计划时仍会级联删除该计划全部精选照片记录，并清理对应的全部 OSS 文件。

### Apifox 联调速查

先通过 `GET /api/crush-date/plans` 从 `completedPlans` 中取得真实计划 ID。URL 中的
`{planId}` 是路径参数占位符，发送时必须替换成真实 ID，不能原样保留。以下三个接口都不需要
Query 参数。

假设过去计划 ID 为 `plan-c39bc3bf-176d-4068-a4aa-123456789abc`：

1. 上传照片：
   - 方法选择 `POST`。
   - URL 填写
     `http://localhost:3000/api/crush-date/plans/plan-c39bc3bf-176d-4068-a4aa-123456789abc/photos`。
   - Body 选择 `form-data`。
   - 新增字段 `file`，字段类型选择“文件”，然后选择一张图片。
   - 不要手动填写 `Content-Type`，让 Apifox 自动生成包含 boundary 的
     `multipart/form-data`。
2. 查询照片：
   - 方法选择 `GET`，URL 使用上述计划 ID 并以 `/photos` 结尾。
   - Body 选择 `none`，直接发送。
   - 记录响应 `list` 中的照片 `id`，排序接口使用照片 ID，不使用 URL。
3. 调整顺序：
   - 方法选择 `PATCH`，URL 以 `/photos/order` 结尾。
   - Body 选择 `JSON`，按期望顺序完整提交全部照片 ID：

```json
{
  "photoIds": ["photo-03", "photo-01", "photo-02"]
}
```

4. 删除单张照片：
   - 方法选择 `DELETE`。
   - URL 填写
     `http://localhost:3000/api/crush-date/plans/{真实计划ID}/photos/{真实照片ID}`。
   - Body 选择 `none`，不需要 Query 参数。
   - 成功状态码是 `204`，没有响应体；删除后重新查询照片列表。

联调删除过去计划时，方法选择 `DELETE`，请求
`/api/crush-date/plans/{真实计划ID}`，Body 选择 `none`。成功状态码为 `204`，照片记录与
该计划一起删除，后端同步清理对应的精选照片 OSS 文件。

## 单独上传图片

该接口作为独立上传能力保留；普通的新增内容流程不需要调用它。

```http
POST /api/crush-date/uploads/images
Content-Type: multipart/form-data
```

表单字段：

- `file`：必填，图片文件。
- `contentType`：必填，仅支持 `food` 或 `place`。

成功时返回 `201 Created`：

```json
{
  "url": "https://xuxiao-cursh-date-images.oss-cn-beijing.aliyuncs.com/crush-date/foods/2026/07/uuid.webp",
  "objectKey": "crush-date/foods/2026/07/uuid.webp"
}
```
