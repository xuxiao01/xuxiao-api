<p align="center">
  <img src="https://typorabucket0308.oss-cn-beijing.aliyuncs.com/images/20260603103934962.jpg" alt="项目预览图" width="800" />
</p>

<h1 align="center">xuxiao-api</h1>
<p align="center">
个人产品矩阵的聚合后端 API 服务，目前提供 Weekly Lab 周报管理与 Crush Date 内容录入能力。
</p>

## 项目简介

`xuxiao-api` 是一个基于 Node.js + Express + PostgreSQL 的后端项目，为个人站点和产品矩阵提供统一的接口层。

当前已实现用户注册登录（JWT）、周报 CRUD、周报公开开关与公开展示等能力。前端提交结构化的周报数据，后端负责存储、鉴权与对外输出。

Crush Date 当前支持无需登录地新增美食或地点，并通过后端上传图片到 OSS。

更完整的接口说明见 [`doc/weekly-lab/api.md`](./doc/weekly-lab/api.md)。

## 功能特性

- 用户注册、登录、获取当前用户信息
- JWT 鉴权，统一的成功 / 失败响应格式
- 周报列表、详情、新建 / 覆盖保存、删除
- 按 `weekKey`（如 `2026-W24`）管理每周周报
- 周报公开开关与公开展示接口
- 基于 zod 的请求参数校验
- Prisma 管理 PostgreSQL 数据模型与迁移
- Crush Date 新增美食或地点
- Crush Date 图片上传到阿里云 OSS

## 技术栈

- Node.js
- TypeScript
- Express 5
- PostgreSQL
- Prisma 7
- JWT（jsonwebtoken）
- bcrypt（密码加密）
- zod（参数校验）
- pnpm（包管理）

## 目录结构

```text
xuxiao-api/
├── prisma/                  # Prisma schema 与数据库迁移
├── doc/
│   ├── weekly-lab/          # Weekly Lab 接口与设计文档
│   └── crush-date/          # Crush Date 接口与设计文档
├── src/
│   ├── config/              # 环境变量配置
│   ├── lib/                 # Prisma Client 单例
│   ├── middleware/          # 全局错误处理
│   ├── modules/
│   │   ├── index.ts         # 业务模块注册中心
│   │   ├── crush-date/      # Crush Date 独立业务模块
│   │   └── weekly-lab/      # Weekly Lab 独立业务模块
│   │       ├── auth/        # 认证与鉴权
│   │       ├── user/        # 用户服务
│   │       └── weekly-report/ # 周报业务
│   ├── utils/               # 跨模块通用工具
│   ├── app.ts               # Express 应用
│   └── main.ts              # 入口文件
├── .env.example
├── package.json
└── tsconfig.json
```

## 接口一览

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前用户 |
| PATCH | `/api/auth/me/weekly-settings` | 是 | 周报公开开关 |
| GET | `/api/weekly-reports` | 是 | 周报列表 |
| GET | `/api/weekly-reports/:weekKey` | 是 | 周报详情 |
| PUT | `/api/weekly-reports/:weekKey` | 是 | 新建 / 覆盖保存 |
| DELETE | `/api/weekly-reports/:weekKey` | 是 | 删除周报 |
| GET | `/api/public/users/:username/weekly-reports/:weekKey` | 否 | 公开展示 |
| GET | `/api/crush-date/foods` | 否 | 获取 Crush Date 美食列表 |
| GET | `/api/crush-date/places` | 否 | 获取 Crush Date 出去玩的地点列表 |
| POST | `/api/crush-date/content-items` | 否 | 上传图片并新增 Crush Date 美食或地点 |
| DELETE | `/api/crush-date/content-items/:id` | 否 | 删除 Crush Date 美食或地点 |
| PATCH | `/api/crush-date/content-items/:id/visited` | 否 | 标记或撤销吃过、去过状态 |
| GET | `/api/crush-date/plans` | 否 | 获取 Crush Date 计划列表 |
| POST | `/api/crush-date/plans` | 否 | 新增 Crush Date 本次计划或备用计划 |
| GET | `/api/crush-date/plans/:id` | 否 | 获取 Crush Date 计划详情 |
| PATCH | `/api/crush-date/plans/:id` | 否 | 修改 Crush Date 本次计划或备用计划 |
| DELETE | `/api/crush-date/plans/:id` | 否 | 删除 Crush Date 本次计划或备用计划 |
| POST | `/api/crush-date/plans/:id/activate` | 否 | 将 Crush Date 备用计划设为本次计划 |
| POST | `/api/crush-date/plans/:id/complete` | 否 | 完成 Crush Date 本次计划 |
| POST | `/api/crush-date/plans/:id/replan` | 否 | 将 Crush Date 过去计划再次设为本次计划 |
| POST | `/api/crush-date/uploads/images` | 否 | 上传 Crush Date 图片到 OSS |

请求 / 响应示例、错误码与测试顺序见 [`doc/weekly-lab/api.md`](./doc/weekly-lab/api.md)。

## 本地运行

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

根据实际情况修改 `.env`（见下方环境变量说明）。

### 3. 准备数据库

确保 PostgreSQL 已启动，并创建数据库：

```bash
createdb xuxiao_api
```

> macOS Homebrew 安装的 PostgreSQL 通常使用当前系统用户名连接。若连接失败，可将 `DATABASE_URL` 改为本地用户名，例如：`postgresql://你的用户名@localhost:5432/xuxiao_api?schema=public`

### 4. 执行数据库迁移

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

### 5. 启动开发服务

```bash
pnpm dev
```

默认地址：`http://localhost:3000`

只加载 Weekly Lab 模块：

```bash
pnpm dev:weekly
```

只加载 Crush Date 模块：

```bash
pnpm dev:crush-date
```

`APP_MODULES` 支持以逗号分隔模块名；不配置或设置为 `all` 时加载全部模块。

### 6. 生产构建与启动

```bash
pnpm build
pnpm start
```

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORT` | 服务端口 | `3000` |
| `APP_MODULES` | 启用的业务模块，默认全部 | `all` 或 `weekly-lab` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@localhost:5432/xuxiao_api?schema=public` |
| `JWT_SECRET` | JWT 签名密钥（请使用强随机字符串） | `please_change_me` |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` |

> `.env` 包含敏感信息，请勿提交到 Git。生产环境请重新生成 `JWT_SECRET`。

## Prisma 常用命令

```bash
pnpm prisma:generate   # 生成 Prisma Client
pnpm prisma:migrate    # 创建并应用迁移（开发环境）
pnpm prisma:studio     # 打开 Prisma Studio
```

生产环境应用迁移：

```bash
DATABASE_URL="你的生产库连接串" npx prisma migrate deploy
```

## 部署说明

本项目为 Node.js 后端服务，典型部署流程如下：

1. 将代码部署到服务器（git clone、scp 等方式）
2. 配置生产环境 `.env`
3. 执行 `pnpm install`、`pnpm prisma generate`、`pnpm build`
4. 执行 `prisma migrate deploy` 初始化 / 更新数据库
5. 使用 PM2 或 systemd 启动：`pnpm start`

生产环境建议使用 Nginx 反向代理到 Node.js 服务，并配置 HTTPS。

当前线上环境与接口地址见 [`doc/weekly-lab/api.md`](./doc/weekly-lab/api.md)。

## 后续计划

- 图片上传接口（`POST /api/uploads/images`）
- 扩展项目、评论、点赞等模块
- 收紧 CORS 白名单（按前端域名配置）
- 补充自动化部署与 CI 配置

## License

ISC
