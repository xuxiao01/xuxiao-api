# Crush Date 内容城市与分类迁移手册

本手册用于 `20260814000000_add_content_item_city_category` 上线。迁移只增加字段、约束和
索引，不更新原有业务字段，也不操作 OSS。生产执行前仍必须完成可恢复备份。

地点数字分类由后续迁移 `20260814120000_add_place_categories` 引入。该自动迁移把地点的旧
`other` 精确转换为 `7`，但在发布兼容窗口内仍允许旧应用写入 `other`。

美食数字分类由迁移 `20260814140000_convert_food_categories_to_numeric` 引入，按固定映射
把现有语义编码转换为 `2`～`9`，同时在发布兼容窗口内允许旧应用继续写入语义编码。

## 上线前

1. 确认当前代码中的全部迁移已在生产库登记：

   ```bash
   pnpm exec prisma migrate status
   ```

2. 使用云数据库快照，或通过 `pg_dump --format=custom` 创建带时间戳的备份；使用
   `pg_restore --list` 确认备份文件可以读取。不要把连接串或备份文件提交到 Git。
3. 在由该备份恢复出的临时数据库运行 `pnpm exec prisma migrate deploy`，然后执行本文的
   上线后核验 SQL。
4. 记录迁移前行数：

   ```sql
   SELECT content_type, COUNT(*)
   FROM crush_date_content_items
   GROUP BY content_type
   ORDER BY content_type;
   ```

## 上线与核验

服务器应先完成依赖安装、Prisma Client 生成和 TypeScript 构建，再运行：

```bash
pnpm exec prisma migrate deploy
```

迁移后执行只读核验：

```sql
SELECT content_type, COUNT(*)
FROM crush_date_content_items
GROUP BY content_type
ORDER BY content_type;

SELECT COUNT(*) AS invalid_code_count
FROM crush_date_content_items
WHERE city_code NOT IN ('beijing', 'tianjin', 'harbin')
   OR (
     content_type = 'food'
     AND category_id NOT IN (
       'chinese', 'hotpot', 'barbecue', 'asian', 'western',
       'snack_fastfood', 'dessert_drinks', 'other'
     )
   )
   OR (
     content_type = 'place'
     AND category_id NOT IN ('2', '3', '4', '5', '6', '7', 'other')
   );

SELECT COUNT(*) AS null_count
FROM crush_date_content_items
WHERE city_code IS NULL OR category_id IS NULL;
```

迁移后，行数必须与迁移前一致，`invalid_code_count` 和 `null_count` 必须均为 0。
随后检查健康接口以及美食、地点列表、新增、详情和 visited 接口。

## 回滚

- 应用异常时回滚应用版本，保留新增列、约束和索引；旧版本可以忽略新列并依赖数据库默认值继续写入。
- 不要在热回滚中删除 `city_code` 或 `category_id`。
- 只有出现无法通过应用回滚解决的数据事故时，才在停写后使用已验证备份恢复数据库。

## 数字分类第二阶段收紧

新版应用稳定且旧版本回滚窗口关闭后，先执行只读检查：

```sql
SELECT COUNT(*) AS legacy_category_count
FROM crush_date_content_items
WHERE (
    content_type = 'place'
    AND category_id = 'other'
  )
  OR (
    content_type = 'food'
    AND category_id IN (
      'chinese', 'hotpot', 'barbecue', 'asian', 'western',
      'snack_fastfood', 'dessert_drinks', 'other'
    )
  );
```

完成新备份后，人工执行：

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f doc/crush-date/sql/complete-numeric-category-migration.sql
```

脚本会在同一事务中转换所有残留兼容值，并把美食约束收紧为 `2`～`9`、地点约束收紧为
`2`～`7`，同时移除不再适用于两种内容的数据库默认值 `other`。执行此脚本的同一发布中，
还应从 Prisma 模型的 `categoryId` 移除 `@default("other")` 并重新生成 Client。执行后不能直接
回滚到仍写入语义分类的旧应用版本。

## 历史数据审核回填

功能稳定后，可通过以下只读 SQL 导出待审核记录：

```sql
SELECT id, name, type, comment, city_code, category_id
FROM crush_date_content_items
WHERE content_type IN ('food', 'place')
ORDER BY created_at ASC, id ASC;
```

先形成逐 ID 的城市和分类建议并由产品侧确认。确认后的更新必须满足：

- 更新条件使用明确的 `id`，不根据自由文本直接批量覆盖。
- 执行前再次备份，并保存更新前后对照清单。
- 所有更新放在一个事务中，更新数量与审核清单一致后才提交。
- 回填后重新核对总行数及图片、名称、备注、visited、visitedAt 等旧字段。

线上只读扫描和实际回填不属于代码部署步骤，必须另行获得明确授权。
