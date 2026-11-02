# 独立部署与回滚

面经仅运行在 `mianjing-api.service`，监听 `127.0.0.1:3301`；外部入口 `/api/mianjing/`。现有共享 API 3000、script-hub 3100 和静态项目不重启。管理员登录仍请求共享 `/api/auth/login`，两个服务复用已有管理员 JWT 配置；游客独立密钥只保存在新服务环境文件。

## 发布目标与 CI

后端 main 的 `type(mianjing):` 提交通过文件白名单校验后，只发布独立面经服务，越界立即失败。其他范围提交保留原共享发布流程。PR 只检查；手动发布仅 main 可激活，目标默认 mianjing。

CI 使用 Node.js 22、24，执行单元、真实 PostgreSQL 接口及发布保护测试。面经 API 测试使用单独空库，与其他产品迁移测试隔离。Node 24 构建产物附 SHA，经 Actions 上传；服务器只在新目录安装固定 pnpm 10.13.1 的冻结依赖，不变更全局 Node/pnpm。

复用现有 TENCENT_SERVER_* 仓库部署 Secrets，增加 TENCENT_SERVER_KNOWN_HOSTS，值来自可信 SSH 连接的已核验主机公钥。部署严格检查主机密钥。

## 一次性准备

管理员运行 `deploy/mianjing/bootstrap.py`，创建独立低权限运行账号、受保护环境文件及 systemd 单元；不启动服务或改 Nginx。环境复用已有数据库和管理员 JWT，配置管理员 ID 2，并生成 48 字节随机游客密钥。不会修改共享服务的 .env 或用户密码。

## 自动发布

1. 上传 SHA 校验产物到 `/www/wwwroot/mianjing-api/incoming/<SHA>-<RUN>-<ATTEMPT>`，加独立文件锁并拒绝过时 main。
2. 校验数据库已应用迁移与文件 SHA-256。已应用但未入 Git 的历史从原服务只读复制，校验后归档；唯一允许新增的是 `20261102000000_add_mianjing`。失败记录、未知待执行迁移或校验不一致均停止。
3. 首次迁移前用 pg_dump 备份到 `/www/backup/mianjing-deploy/<release>/database.dump`，目录 700，校验 pg_restore 列表。只允许面经迁移执行，不改其他表。
4. 原子切换独立 current 链接，仅启动或重启 mianjing-api；本机就绪通过后才安装独立 Nginx include，备份配置、语法检查后平滑重载。
5. HTTPS 检查公开 `/api/mianjing/health` 的 apiVersion=1、就绪状态和 SHA，再验证游客 /me、列表、公司库。比较共享进程 PID 和环境文件摘要，保留五个版本。

就绪接口仅返回状态、接口版本和 SHA；缺少配置、管理员或表时 503，不暴露密钥与数据。

## 回滚

脚本失败自动恢复 Nginx 配置和原 current，仅重启面经服务；首次失败则停止新服务并移除 current。不会恢复整个共享数据库或自动删除新表。

手动回滚时，列出 releases，选择已验证的旧目录；将 current 原子切回对应目录，只执行 `systemctl restart mianjing-api.service`，检查 health 的 SHA 和游客接口。不得执行 pm2 restart all 或更改共享 API。

前端 Actions 发布前还会执行独立后端就绪门禁。只有后端管理员、游客及其他项目回归验证完成后，才合并前端 main 发布。
