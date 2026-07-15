# Weekly Lab 接口文档

## 环境地址

| 环境 | 基础地址 |
|------|----------|
| 生产 | `http://101.42.137.241` |
| 本地 | `http://localhost:3000`（可通过环境变量 `PORT` 修改） |

下文路径均相对于基础地址，例如生产环境健康检查为：

```
GET http://101.42.137.241/api/health
```

---

## 通用说明

### 请求格式

- 需要请求体的接口：`Content-Type: application/json`
- 需要鉴权的接口：在 Header 中携带 `Authorization: Bearer <token>`

### 响应格式

**成功：**

```json
{
  "success": true,
  "data": {}
}
```

**失败：**

```json
{
  "success": false,
  "message": "错误信息"
}
```

健康检查接口除外，其成功响应为 `{ "success": true, "message": "..." }`。

---

## 接口总览

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前登录用户 |
| PATCH | `/api/auth/me/weekly-settings` | 是 | 设置周报公开开关 |
| GET | `/api/weekly-reports` | 是 | 获取当前用户周报列表 |
| GET | `/api/weekly-reports/:weekKey` | 是 | 获取某一周周报详情 |
| PUT | `/api/weekly-reports/:weekKey` | 是 | 新建或覆盖保存某一周周报 |
| DELETE | `/api/weekly-reports/:weekKey` | 是 | 删除某一周周报 |
| GET | `/api/public/users/:username/weekly-reports/:weekKey` | 否 | 公开展示某用户某周周报 |

> 暂未实现：`POST /api/uploads/images`（图片上传，后续补充）

---

## 1. 健康检查

```
GET /api/health
```

### 响应

**200 OK**

```json
{
  "success": true,
  "message": "xuxiao-api is running"
}
```

---

## 2. 用户注册

```
POST /api/auth/register
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 合法邮箱格式 |
| username | string | 是 | 2–30 个字符 |
| password | string | 是 | 至少 6 位 |

### 请求示例

```json
{
  "email": "test@example.com",
  "username": "小徐",
  "password": "123456"
}
```

### 响应

**201 Created**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "username": "小徐",
      "createdAt": "2026-06-22T09:34:38.007Z"
    }
  }
}
```

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 400 | 参数校验失败信息 | email / username / password 不符合规则 |
| 409 | 该邮箱已被注册 | 邮箱已存在 |

---

## 3. 用户登录

```
POST /api/auth/login
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 合法邮箱格式 |
| password | string | 是 | 不能为空 |

### 请求示例

```json
{
  "email": "test@example.com",
  "password": "123456"
}
```

### 响应

**200 OK**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "username": "小徐",
      "createdAt": "2026-06-22T09:34:38.007Z"
    }
  }
}
```

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 400 | 参数校验失败信息 | email / password 不符合规则 |
| 401 | 邮箱或密码错误 | 邮箱不存在或密码不正确（不区分具体原因） |

---

## 4. 获取当前用户

```
GET /api/auth/me
```

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |

### 响应

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "test@example.com",
    "username": "小徐",
    "createdAt": "2026-06-22T09:34:38.007Z"
  }
}
```

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 401 | 未授权 | 未携带 token、格式错误、token 无效或过期 |
| 401 | 用户不存在 | token 有效但对应用户已被删除 |

---

## 5. 设置周报公开开关

```
PATCH /api/auth/me/weekly-settings
```

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| publicWeeklyReportsEnabled | boolean | 是 | 是否允许他人通过公开链接查看周报 |

### 请求示例

```json
{
  "publicWeeklyReportsEnabled": true
}
```

### 响应

**200 OK**

```json
{
  "success": true,
  "data": {
    "publicWeeklyReportsEnabled": true
  }
}
```

---

## 6. 获取周报列表

```
GET /api/weekly-reports
```

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |

### 响应

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "2026-W24",
      "weekLabel": "2026 第 24 周",
      "dateRange": "2026.06.08 - 2026.06.12",
      "shortDateRange": "06.08 - 06.12",
      "reportCount": 2,
      "isPublished": false,
      "updatedAt": "2026-06-22T10:00:00.000Z"
    }
  ]
}
```

按 `startDate` 倒序排列。

---

## 7. 获取某一周周报详情

```
GET /api/weekly-reports/:weekKey
```

### 路径参数

| 参数 | 说明 |
|------|------|
| weekKey | 周标识，格式 `YYYY-W01` ~ `YYYY-W53`，如 `2026-W24` |

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |

### 响应

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "2026-W24",
    "weekLabel": "2026 第 24 周",
    "dateRange": "2026.06.08 - 2026.06.12",
    "shortDateRange": "06.08 - 06.12",
    "isPublished": false,
    "reports": [
      {
        "id": 1,
        "weekLabel": "2026 第 24 周",
        "dateRange": "2026.06.08 - 2026.06.12",
        "shortDateRange": "06.08 - 06.12",
        "partLabel": "第一部分",
        "title": "小墨作文小游戏开发",
        "completed": [
          {
            "title": "完成文字翻翻卡",
            "description": "",
            "images": []
          }
        ],
        "nextPlans": [
          {
            "title": "优化 UI",
            "description": "",
            "images": ["https://example.com/a.png"]
          }
        ]
      }
    ]
  }
}
```

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 400 | week_key 格式非法 | weekKey 不符合 `YYYY-W01` ~ `YYYY-W53` |
| 404 | 周报不存在 | 该周尚无数据 |

---

## 8. 新建或覆盖保存某一周周报

```
PUT /api/weekly-reports/:weekKey
```

### 路径参数

| 参数 | 说明 |
|------|------|
| weekKey | 周标识，格式 `YYYY-W01` ~ `YYYY-W53`，如 `2026-W24` |

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |
| Content-Type | `application/json` |

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startDate | string | 新建必填 | 周起始日期，`YYYY-MM-DD` |
| endDate | string | 新建必填 | 周结束日期，`YYYY-MM-DD` |
| isPublished | boolean | 否 | 是否公开发布，默认 `false` |
| reports | array | 是 | 周报内容，`[]` 表示空周报 |

**reports 数组元素：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| partLabel | string | 是 | 部分标签，如「第一部分」 |
| title | string | 是 | 该部分标题 |
| completed | array | 否 | 本周完成条目，默认 `[]` |
| nextPlans | array | 否 | 未来计划条目，默认 `[]` |

**completed / nextPlans 数组元素：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 条目标题 |
| description | string | 否 | 描述，默认 `""` |
| images | string[] | 否 | 图片 URL 数组，默认 `[]` |

### 请求示例

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
        { "title": "完成文字翻翻卡", "description": "", "images": [] }
      ],
      "nextPlans": [
        { "title": "优化 UI", "description": "", "images": ["https://example.com/a.png"] }
      ]
    }
  ]
}
```

### 响应

- 新建成功：**201 Created**
- 覆盖保存：**200 OK**

响应体与「获取某一周周报详情」相同。

### 规则说明

- `weekKey` 只从 URL 读取，body 不要传 `weekKey`
- `reports` 必填；`reports: []` 表示空周报
- 更新已存在周报时，`startDate` / `endDate` 可省略（沿用原值）
- Markdown 导入由前端解析为 `reports` 后再提交，后端不接收 `markdown` 字段
- 保存为全量覆盖：每次 PUT 会替换该周全部 report 与 item

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 400 | 新建周报时 startDate 和 endDate 必填 | 首次创建缺少日期 |
| 400 | startDate 不能晚于 endDate | 日期范围非法 |
| 400 | week_key 格式非法 | weekKey 不符合规范 |
| 400 | 参数校验失败信息 | reports 结构不合法、images 非 URL 等 |

---

## 9. 删除某一周周报

```
DELETE /api/weekly-reports/:weekKey
```

### 路径参数

| 参数 | 说明 |
|------|------|
| weekKey | 周标识，如 `2026-W24` |

### 请求头

| 字段 | 值 |
|------|-----|
| Authorization | `Bearer <token>` |

### 响应

**200 OK**

```json
{
  "success": true,
  "data": null
}
```

### 错误

| 状态码 | message | 说明 |
|--------|---------|------|
| 404 | 周报不存在 | 该周尚无数据 |

---

## 10. 公开展示某用户某周周报

```
GET /api/public/users/:username/weekly-reports/:weekKey
```

无需鉴权。

### 路径参数

| 参数 | 说明 |
|------|------|
| username | 用户注册时的 `username`（不是 email） |
| weekKey | 周标识，如 `2026-W24` |

### 访问条件

需同时满足：

1. 用户 `publicWeeklyReportsEnabled = true`（通过 PATCH 周报公开开关开启）
2. 该周 `isPublished = true`（保存周报时设置）

不满足时返回 **404 周报不存在**（不暴露是否存在）。

### 响应

**200 OK** — 结构与「获取某一周周报详情」相同，但不包含鉴权。

### 示例

```
GET http://101.42.137.241/api/public/users/小徐/weekly-reports/2026-W24
```

> 若 username 含中文或特殊字符，需 URL 编码。

---

## 数据模型

### User（对外返回字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 用户 ID |
| email | string | 邮箱，唯一 |
| username | string | 用户名，公开链接中使用此字段 |
| createdAt | string (ISO 8601) | 创建时间 |

> `passwordHash` 仅存储在数据库中，接口不会返回。

### JWT Token 载荷

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | number | 用户 ID |
| email | string | 用户邮箱 |

Token 有效期由环境变量 `JWT_EXPIRES_IN` 控制，默认 `7d`。

---

## Apifox 测试顺序

### 认证

1. `GET /api/health` — 确认服务正常
2. `POST /api/auth/register` — 注册账号（生产环境建议注册正式账号）
3. `POST /api/auth/login` — 登录，复制 `data.token`
4. `GET /api/auth/me` — Header 填入 `Authorization: Bearer <token>`

### 周报

1. 登录获取 token
2. `PUT /api/weekly-reports/2026-W24` — 创建周报
3. `GET /api/weekly-reports` — 查看列表
4. `GET /api/weekly-reports/2026-W24` — 查看详情
5. `PATCH /api/auth/me/weekly-settings` — 开启公开开关 `{ "publicWeeklyReportsEnabled": true }`
6. `PUT /api/weekly-reports/2026-W24` — 设置 `isPublished: true`
7. `GET /api/public/users/{username}/weekly-reports/2026-W24` — 验证公开访问（username 填注册时的用户名）
8. `DELETE /api/weekly-reports/2026-W24` — 删除周报

> Apifox 环境变量建议：`baseUrl = http://101.42.137.241`，`token` 在登录后自动写入。
