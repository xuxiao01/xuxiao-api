# 面经台本地验证与上线边界

## 模块和管理员

```sh
pnpm prisma:generate
pnpm build
pnpm dev:mianjing
```

`APP_MODULES=mianjing` 单独启用面经，同时复用注册现有 `/api/auth` 路由。与 weekly-lab 一起启用时由原模块注册认证，不重复挂载。`APP_MODULES=all` 包含面经；crush-date 单独运行不依赖新增管理员配置。

设置服务端 `MIANJING_ADMIN_USER_ID` 为现有 User.id，不能填邮箱，不能放入前端 VITE 环境变量。留空则普通账号均不能进入，不自动创建账号或把第一个注册者设为管理员。管理员仍使用现有 DATABASE_URL、JWT_SECRET 和 JWT_EXPIRES_IN，不修改账号密码。

本次管理员 ID 为 2。另需配置 MIANJING_GUEST_JWT_SECRET：至少 32 字符的独立随机密钥，不得与 JWT_SECRET 相同。缺失时游客入口返回 503，但不影响其他产品。游客 Token 仅面经可用，一小时有效。

## 数据库变更

迁移文件：`prisma/migrations/20261102000000_add_mianjing/migration.sql`。

只新增三张 mianjing 表、六个枚举、索引、检查约束及外键，放在一个 PostgreSQL DDL 事务内；不会修改 User、周报或 Crush Date 表。公司数组没有独立关联表。没有默认题目、演示记录或管理员种子数据，初始公司库为空。

实现阶段只生成迁移文件和 Prisma Client，不执行生产迁移。上线前需确认数据库、管理员账号和当前全部待执行迁移，特别是仓库中其他产品尚未提交的迁移；备份数据库后，再由部署阶段应用审核过的迁移。不要为上线执行 `prisma migrate dev` 或 reset。

## 测试

```sh
pnpm test
pnpm test:mianjing
pnpm build
```

真实接口测试使用编译后的 Express 服务及真实 PostgreSQL，不 mock 数据仓储。必须手动指定独立空测试库，要求主机为 localhost / 127.0.0.1、数据库名以 `_test` 结尾，且 public 没有现有表；不读取现有 .env 的数据库地址执行测试写入。

```sh
MIANJING_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:5432/mianjing_api_test' pnpm test:mianjing:integration
```

测试仅在该空库创建既有用户表的测试结构、应用面经迁移，结束后清理本套测试创建的对象；未配置变量时跳过，不自动创建数据库。不应指向任何开发或生产业务库。

覆盖：真实账号登录、游客只读、无管理员配置、来源完整性、数组去重、同公司独立计次、字面搜索及排序分页、超大内容、并发追加、总次数上下限、公司更名互换及停用、直接删除、数据库触发错误时整体回滚。

## 前端接入与发布边界

前后端本轮均在 `codex/mianjing-login-api` 功能分支联调；前端接入登录、独立游客会话、服务端分页／详情／公司库及全部写入，数据管理改为云端概况。没有 snapshot、experiences、旧数据兼容或备份接口。

不合并 main，不执行生产迁移，不部署。后续先审核迁移并上线后端，配置 ID 2 和独立游客密钥、验证管理员及游客，再合并前端由既有 Actions 发布。不要提前发布前端 API 版本。
