# xuxiao-api 接口文档

> 基础地址：`http://localhost:3000`（可通过环境变量 `PORT` 修改）

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

## 接口列表

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前登录用户 |

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

## 数据模型

### User（对外返回字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 用户 ID |
| email | string | 邮箱，唯一 |
| username | string | 用户名 |
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

1. `GET /api/health` — 确认服务正常
2. `POST /api/auth/register` — 注册账号
3. `POST /api/auth/login` — 登录，复制 `data.token`
4. `GET /api/auth/me` — Header 填入 `Authorization: Bearer <token>`

---

## 周报接口

> 以下接口均需鉴权（除公开展示外）：`Authorization: Bearer <token>`

### 周报列表

```
GET /api/weekly-reports
```

### 获取一周周报

```
GET /api/weekly-reports/:weekKey
```

`:weekKey` 格式：`YYYY-W01` ~ `YYYY-W53`，如 `2026-W24`

### 新建或覆盖保存一周周报

```
PUT /api/weekly-reports/:weekKey
Content-Type: application/json
```

**结构化 JSON 示例：**

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

- 新建成功返回 `201`，覆盖保存返回 `200`
- `reports` 必填；`reports: []` 表示空周报
- Markdown 导入由前端解析为 `reports` 后再提交，后端不接收 `markdown` 字段
- body 不要传 `weekKey`（只从 URL 读取）

### 删除一周周报

```
DELETE /api/weekly-reports/:weekKey
```

### 公开展示

```
GET /api/public/users/:username/weekly-reports/:weekKey
```

需同时满足：用户 `publicWeeklyReportsEnabled = true` 且该周 `isPublished = true`

### 用户周报公开开关

```
PATCH /api/auth/me/weekly-settings
Content-Type: application/json

{ "publicWeeklyReportsEnabled": true }
```

---

## 周报 Apifox 测试顺序

1. 登录获取 token
2. `PUT /api/weekly-reports/2026-W24` 创建周报
3. `GET /api/weekly-reports` / `GET /api/weekly-reports/2026-W24`
4. `PATCH /api/auth/me/weekly-settings` 开启公开开关
5. `PUT` 设置 `isPublished: true`
6. `GET /api/public/users/{email}/weekly-reports/2026-W24`
7. `DELETE /api/weekly-reports/2026-W24`
