# xuxiao-api

个人产品矩阵的可复用后端 API 服务。第一阶段提供基础认证能力，后续将扩展周报、项目、评论、点赞、文件上传等模块。

## 技术栈

- **运行环境**: Node.js
- **语言**: TypeScript
- **Web 框架**: Express
- **数据库**: PostgreSQL
- **ORM**: Prisma 7
- **认证**: JWT
- **密码加密**: bcrypt
- **参数校验**: zod
- **包管理器**: pnpm

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

根据实际情况修改 `.env` 中的配置项（见下方说明）。

### 3. 准备数据库

确保 PostgreSQL 已启动，并创建数据库：

```bash
createdb xuxiao_api
```

> macOS Homebrew 安装的 PostgreSQL 通常使用当前系统用户名连接，无需密码。若连接失败，请将 `.env` 中的 `DATABASE_URL` 改为你的本地用户名，例如：`postgresql://你的用户名@localhost:5432/xuxiao_api?schema=public`

### 4. 初始化 Prisma

```bash
pnpm prisma:migrate    # 首次迁移，名称可填 init_user
pnpm prisma:generate   # migrate 通常会自动执行 generate
```

### 5. 启动开发服务

```bash
pnpm dev
```

服务默认运行在 `http://localhost:3000`。

### 6. 生产构建

```bash
pnpm build
pnpm start
```

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@localhost:5432/xuxiao_api?schema=public` |
| `JWT_SECRET` | JWT 签名密钥（请使用强随机字符串） | `your-secret-key` |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` |

> `.env` 文件包含敏感信息，请勿提交到 Git。

## Prisma 常用命令

```bash
pnpm prisma:generate   # 生成 Prisma Client
pnpm prisma:migrate    # 创建并应用迁移（开发环境）
pnpm prisma:studio     # 打开 Prisma Studio 可视化管理数据
```

## 当前接口列表

### 健康检查

```
GET /api/health
```

响应：

```json
{
  "success": true,
  "message": "xuxiao-api is running"
}
```

### 用户注册

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "username": "小徐",
  "password": "123456"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "username": "小徐"
    }
  }
}
```

### 用户登录

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456"
}
```

### 获取当前用户

```
GET /api/auth/me
Authorization: Bearer <token>
```

响应：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "test@example.com",
    "username": "小徐"
  }
}
```

## 项目结构

```
xuxiao-api
├── prisma/              # Prisma schema 与迁移
├── src/
│   ├── config/          # 环境变量配置
│   ├── lib/             # Prisma Client 单例
│   ├── middleware/      # Express 中间件
│   ├── modules/         # 业务模块（auth、user 等）
│   ├── utils/           # 工具函数
│   ├── app.ts           # Express 应用
│   └── main.ts          # 入口文件
├── .env.example
├── package.json
└── tsconfig.json
```

## Apifox 测试建议

1. 先调用 `GET /api/health` 确认服务正常
2. 调用 `POST /api/auth/register` 注册账号
3. 调用 `POST /api/auth/login` 登录，复制返回的 `token`
4. 调用 `GET /api/auth/me`，在 Header 中设置 `Authorization: Bearer <token>`
