# 宁夏城市白名单修复

迁移：`20261025000000_add_ningxia_content_item_cities`。

应用已支持银川、中卫、吴忠，但旧数据库约束只接受北京、天津、哈尔滨，导致创建内容时报
PostgreSQL `23514` / `crush_date_content_items_city_code_check`。本次只扩展该约束，
不更新业务数据、不调整其他约束和索引，不需要重启后端。

## 发布前验证

1. 使用名称以 `_test` 结尾的独立测试库运行：

   ```sh
   pnpm test
   TEST_DATABASE_URL='postgresql://localhost/crush_date_ningxia_test' pnpm test:integration
   pnpm build
   ```

   数据库测试不得跳过。覆盖六城市的美食、地点和有无位置组合，验证迁移前后旧记录、
   其他约束及索引一致，白名单与应用配置完全一致，非法城市和分类、非法位置仍被拒绝。

2. 连接生产服务器，进入 `/www/wwwroot/xuxiao-api`，核对当前约束和
   `_prisma_migrations`；确认没有未解决的失败记录，历史迁移文件 checksum 与登记一致。
3. 在权限为 `700` 的独立备份目录创建带时间戳的数据库备份，文件权限设为 `600`。
   使用 `/www/server/pgsql/bin/pg_dump --format=custom`，通过进程环境传递连接信息，
   不将密码打印到日志、命令行或提交到 Git。使用同目录的 `pg_restore --list` 验证
   备份可读取，并记录备份位置。备份失败时停止发布。

## 执行迁移

1. 只上传本次新增迁移目录；用 SHA-256 核对上传前后 SQL 内容一致。
2. 执行 `pnpm exec prisma migrate status`，确认待执行的只有本次迁移。
   若出现其他待执行迁移、失败记录或历史不一致，停止，不顺带执行。
3. 执行 `pnpm exec prisma migrate deploy`。SQL 在同一事务内替换约束，
   `lock_timeout = 5s`、`statement_timeout = 30s`；拿不到锁或执行超时会回滚。
   若服务器的 pnpm 包装器在 `exec` 时自动安装依赖并失败，使用已安装 CLI 的等价命令
   `node node_modules/prisma/build/index.js migrate deploy`；`status` 和 `resolve`
   也可同样调用。无需重装依赖或修改包管理器策略。
4. 再次执行 `pnpm exec prisma migrate status`，确认数据库已同步，并核验：

   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'crush_date_content_items'::regclass
     AND conname = 'crush_date_content_items_city_code_check';

   SELECT migration_name, finished_at, rolled_back_at
   FROM _prisma_migrations
   WHERE migration_name = '20261025000000_add_ningxia_content_item_cities';
   ```

   城市必须为 `beijing, tianjin, harbin, yinchuan, zhongwei, wuzhong`，
   本次迁移必须已完成且未标记回滚。

## 线上验收与清理

- 检查 `/api/health`；为银川、中卫、吴忠各通过
  `POST /api/crush-date/content-items` 创建一条美食和地点（共六条）。
- 名称使用本次独有的 `迁移验证-<时间戳>` 标记；记录每次成功响应的 ID 和图片地址，
  覆盖有位置与无位置，核验创建返回 `201`，详情及城市列表能读到对应记录。
- 无论验收是否成功，都在清理阶段只删除本次创建的 ID，通过内容删除接口同步清理 OSS。
  确认详情返回 `404`、数据库无本次记录，并通过 OSS SDK 的 `head` 确认原始对象不存在，
  不依赖可能被缓存的公开图片 URL。
- 不清理其他用户数据；若存在清理失败，记录精确 ID / 对象路径并完成重试。

## 失败处理

- 迁移失败后重新连接，确认原约束仍完整存在、事务已回滚。仅在确认为完整回滚时执行
  `pnpm exec prisma migrate resolve --rolled-back 20261025000000_add_ningxia_content_item_cities`，
  排除锁等待等原因后重试同一 SQL，不修改已执行文件来绕过 checksum。
- 若迁移记录显示完成但约束不符合预期，停止后续写入验收并调查，不手工伪造迁移成功记录。
- 成功后保留扩展白名单，旧应用仍兼容。已经产生宁夏业务数据后不得直接恢复三城市约束，
  不删除这些业务数据来强行回退。只有确有数据事故且完成停写安排后，才使用备份恢复。

## 2026-10-25 执行记录

- 本地单元测试 103 项、数据库集成测试 32 项全部通过，`pnpm build` 通过；
  另在独立测试库通过 Prisma 按顺序部署全部 11 条迁移。
- 线上迁移于北京时间 21:26 完成，使用服务器已安装的 Prisma CLI 执行，未重启应用。
- 迁移前后 42 条内容的完整字段校验值一致，其他约束和索引一致。
- 银川、中卫、吴忠的六次创建均返回 `201`，详情和列表查询均返回 `200`；
  三条美食覆盖绑定位置，三条地点覆盖不绑定位置。
- 六条测试记录和六个 OSS 图片对象均已删除；清理后原有记录校验值一致，内容数仍为 42。
- 数据库备份及迁移前后核验、接口验收记录保存在生产服务器受限目录：
  `/www/backup/pgsql_bak/ningxia-city-2026-10-25T13-22-27-844Z/`。
  数据库备份文件为 `database.dump`，已通过 `pg_restore --list` 检查。
