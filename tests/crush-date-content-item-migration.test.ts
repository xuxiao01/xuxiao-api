import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  cities,
  cityAdcodePrefixes,
} from '../src/modules/crush-date/content-item/content-item.config';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const testSchema = 'crush_date_content_item_migration_test';
const describeWithDatabase = databaseUrl ? describe : describe.skip;
let client: Client;
let legacyRowsBefore: Record<string, Record<string, unknown>>;
let rowsBeforeCityMigration: Record<string, unknown>[];
let constraintsBeforeCityMigration: Record<string, unknown>[];
let indexesBeforeCityMigration: Record<string, unknown>[];

async function readOtherConstraints() {
  return (await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'crush_date_content_items'::regclass
      AND conname <> 'crush_date_content_items_city_code_check'
    ORDER BY conname
  `)).rows;
}

async function readIndexes() {
  return (await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = $1 AND tablename = 'crush_date_content_items'
    ORDER BY indexname
  `, [testSchema])).rows;
}

function assertTestDatabase(url: string): void {
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL 必须指向名称以 _test 结尾的独立测试库');
  }
}

describeWithDatabase('Crush Date content item migration', () => {
  beforeAll(async () => {
    assertTestDatabase(databaseUrl!);
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${testSchema}"`);
    await client.query(`SET search_path TO "${testSchema}"`);
    await client.query(`
      CREATE TYPE "CrushDateContentType" AS ENUM ('food', 'place');
      CREATE TABLE "crush_date_content_items" (
        "id" TEXT PRIMARY KEY,
        "content_type" "CrushDateContentType" NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "comment" TEXT NOT NULL,
        "image" TEXT NOT NULL,
        "visited" BOOLEAN NOT NULL DEFAULT false,
        "visited_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL
      );
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "name", "type", "comment", "image",
        "visited", "visited_at", "created_at", "updated_at"
      ) VALUES
      (
        'food-legacy', 'food', '旧美食', '旧类型', '旧备注',
        'https://example.com/legacy.webp', true,
        '2026-08-01T01:02:03.000Z', '2026-07-01T01:02:03.000Z',
        '2026-08-01T01:02:03.000Z'
      ),
      (
        'place-legacy', 'place', '旧地点', '旧地点类型', '旧地点备注',
        'https://example.com/place.webp', false, NULL,
        '2026-07-02T01:02:03.000Z', '2026-08-02T01:02:03.000Z'
      );
    `);

    const beforeResult = await client.query(`
      SELECT id, content_type, name, type, comment, image, visited,
             visited_at, created_at, updated_at
      FROM "crush_date_content_items"
      ORDER BY id
    `);
    legacyRowsBefore = Object.fromEntries(beforeResult.rows.map((row) => [row.id, row]));

    const migration = readFileSync(resolve(
      'prisma/migrations/20260814000000_add_content_item_city_category/migration.sql',
    ), 'utf8');
    await client.query(migration);

    const placeCategoryMigration = readFileSync(resolve(
      'prisma/migrations/20260814120000_add_place_categories/migration.sql',
    ), 'utf8');
    await client.query(placeCategoryMigration);

    const foodCategoryMigration = readFileSync(resolve(
      'prisma/migrations/20260814140000_convert_food_categories_to_numeric/migration.sql',
    ), 'utf8');
    await client.query(foodCategoryMigration);

    const poiLocationMigration = readFileSync(resolve(
      'prisma/migrations/20260817000000_add_content_item_poi_location/migration.sql',
    ), 'utf8');
    await client.query(poiLocationMigration);

    rowsBeforeCityMigration = (await client.query(`
      SELECT * FROM "crush_date_content_items" ORDER BY id
    `)).rows;
    constraintsBeforeCityMigration = await readOtherConstraints();
    indexesBeforeCityMigration = await readIndexes();

    const cityMigration = readFileSync(resolve(
      'prisma/migrations/20261025000000_add_ningxia_content_item_cities/migration.sql',
    ), 'utf8');
    await client.query(cityMigration);
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      await client.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
      await client.end();
    }
  });

  it('保留旧字段并为旧记录填充安全默认值', async () => {
    const result = await client.query(`
      SELECT id, content_type, name, type, comment, image, visited,
             visited_at, created_at, updated_at, city_code, category_id,
             poi_provider, poi_id, poi_title, poi_address, poi_latitude,
             poi_longitude, poi_adcode
      FROM "crush_date_content_items"
    `);

    expect(result.rowCount).toBe(2);
    const rowsById = Object.fromEntries(result.rows.map((row) => [row.id, row]));
    expect(rowsById['food-legacy']).toMatchObject({
      ...legacyRowsBefore['food-legacy'],
      city_code: 'beijing',
      category_id: '9',
      poi_provider: null,
      poi_id: null,
      poi_title: null,
      poi_address: null,
      poi_latitude: null,
      poi_longitude: null,
      poi_adcode: null,
    });
    expect(rowsById['place-legacy']).toMatchObject({
      ...legacyRowsBefore['place-legacy'],
      city_code: 'beijing',
      category_id: '7',
      poi_provider: null,
      poi_id: null,
      poi_title: null,
      poi_address: null,
      poi_latitude: null,
      poi_longitude: null,
      poi_adcode: null,
    });
  });

  it('扩展城市白名单不改变已有记录、其他约束或索引', async () => {
    const result = await client.query(`
      SELECT * FROM "crush_date_content_items" ORDER BY id
    `);
    expect(result.rows).toEqual(rowsBeforeCityMigration);
    expect(await readOtherConstraints()).toEqual(constraintsBeforeCityMigration);
    expect(await readIndexes()).toEqual(indexesBeforeCityMigration);
  });

  it('数据库城市白名单与应用城市配置完全一致', async () => {
    const result = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'crush_date_content_items'::regclass
        AND conname = 'crush_date_content_items_city_code_check'
    `);
    expect(result.rowCount).toBe(1);
    const codes = [...result.rows[0].definition.matchAll(/'([^']+)'/g)]
      .map((match) => match[1]);
    expect(codes.sort()).toEqual(cities.map((city) => city.code).sort());
  });

  it.each(cities.flatMap(({ code }) => (
    (['food', 'place'] as const).flatMap((contentType) => (
      [false, true].map((withLocation) => ({ code, contentType, withLocation }))
    ))
  )))('$code $contentType 可创建，绑定位置：$withLocation', async ({
    code, contentType, withLocation,
  }) => {
    await client.query('BEGIN');
    try {
      const result = await client.query(`
        INSERT INTO "crush_date_content_items" (
          id, content_type, city_code, category_id, name, type, comment, image,
          updated_at, poi_provider, poi_id, poi_title, poi_address,
          poi_latitude, poi_longitude, poi_adcode
        ) VALUES (
          $1, $2, $3, $4, '城市迁移测试', '其他', '',
          'https://example.com/migration-test.png', CURRENT_TIMESTAMP,
          $5, $6, $7, $8, $9, $10, $11
        ) RETURNING city_code, content_type, poi_provider, poi_adcode
      `, [
        `city-test-${code}-${contentType}-${withLocation}`,
        contentType,
        code,
        contentType === 'food' ? '9' : '7',
        ...(withLocation
          ? ['tencent', 'test-poi', '测试位置', '测试地址', 38, 106,
            cityAdcodePrefixes[code].padEnd(6, '0')]
          : [null, null, null, null, null, null, null]),
      ]);
      expect(result.rows[0]).toEqual({
        city_code: code,
        content_type: contentType,
        poi_provider: withLocation ? 'tencent' : null,
        poi_adcode: withLocation ? cityAdcodePrefixes[code].padEnd(6, '0') : null,
      });
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('位置约束只接受完整合法的腾讯 POI', async () => {
    await expect(client.query(`
      UPDATE "crush_date_content_items"
      SET "poi_provider" = 'tencent'
      WHERE "id" = 'food-legacy'
    `)).rejects.toMatchObject({ code: '23514' });

    await expect(client.query(`
      UPDATE "crush_date_content_items"
      SET "poi_provider" = 'amap',
          "poi_id" = 'poi-1',
          "poi_title" = '地点',
          "poi_address" = '地址',
          "poi_latitude" = 39.9,
          "poi_longitude" = 116.4,
          "poi_adcode" = '110105'
      WHERE "id" = 'food-legacy'
    `)).rejects.toMatchObject({ code: '23514' });

    await expect(client.query(`
      UPDATE "crush_date_content_items"
      SET "poi_provider" = 'tencent',
          "poi_id" = 'poi-1',
          "poi_title" = '海底捞火锅（国贸店）',
          "poi_address" = '北京市朝阳区',
          "poi_latitude" = 39.9087,
          "poi_longitude" = 116.4598,
          "poi_adcode" = '110105'
      WHERE "id" = 'food-legacy'
    `)).resolves.toMatchObject({ rowCount: 1 });

    const result = await client.query(`
      SELECT poi_provider, poi_id, poi_latitude, poi_longitude, poi_adcode
      FROM "crush_date_content_items"
      WHERE "id" = 'food-legacy'
    `);
    expect(result.rows[0]).toMatchObject({
      poi_provider: 'tencent',
      poi_id: 'poi-1',
      poi_latitude: '39.908700',
      poi_longitude: '116.459800',
      poi_adcode: '110105',
    });
  });

  it('数据库约束拒绝非法城市和分类', async () => {
    await expect(client.query(`
      UPDATE "crush_date_content_items"
      SET "city_code" = 'shanghai'
      WHERE "id" = 'food-legacy'
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`
      UPDATE "crush_date_content_items"
      SET "category_id" = 'japanese'
      WHERE "id" = 'food-legacy'
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'place-invalid', 'place', 'beijing', 'hotpot', '地点', '公园', '',
        'https://example.com/place.webp', CURRENT_TIMESTAMP
      )
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'food-invalid-number', 'food', 'beijing', '0', '美食', '中餐', '',
        'https://example.com/food.webp', CURRENT_TIMESTAMP
      )
    `)).rejects.toMatchObject({ code: '23514' });
  });

  it('第一阶段允许旧后端写入语义分类，但拒绝跨类型分类', async () => {
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'place-compatible', 'place', 'beijing', 'other', '兼容地点', '地点', '',
        'https://example.com/compatible.webp', CURRENT_TIMESTAMP
      )
    `)).resolves.toMatchObject({ rowCount: 1 });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'food-compatible', 'food', 'beijing', 'hotpot', '兼容美食', '火锅', '',
        'https://example.com/food-compatible.webp', CURRENT_TIMESTAMP
      )
    `)).resolves.toMatchObject({ rowCount: 1 });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'place-food-category', 'place', 'beijing', '8', '错误地点', '地点', '',
        'https://example.com/invalid.webp', CURRENT_TIMESTAMP
      )
    `)).rejects.toMatchObject({ code: '23514' });
  });

  it('创建稳定分页和吃过排序所需索引', async () => {
    const result = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = '${testSchema}'
    `);
    const indexNames = result.rows.map(({ indexname }) => indexname);
    expect(indexNames).toContain(
      'crush_date_content_items_content_type_city_code_visited_cre_idx',
    );
    expect(indexNames).toContain('crush_date_content_items_visited_visited_at_idx');
  });

  it('第二阶段转换兼容值并将地点约束收紧为 2 至 7', async () => {
    const contraction = readFileSync(resolve(
      'doc/crush-date/sql/complete-numeric-category-migration.sql',
    ), 'utf8');
    await client.query(contraction);

    const compatibleRow = await client.query(`
      SELECT category_id
      FROM "crush_date_content_items"
      WHERE id = 'place-compatible'
    `);
    expect(compatibleRow.rows[0].category_id).toBe('7');

    const compatibleFood = await client.query(`
      SELECT category_id
      FROM "crush_date_content_items"
      WHERE id = 'food-compatible'
    `);
    expect(compatibleFood.rows[0].category_id).toBe('3');

    const categoryDefault = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = '${testSchema}'
        AND table_name = 'crush_date_content_items'
        AND column_name = 'category_id'
    `);
    expect(categoryDefault.rows[0].column_default).toBeNull();

    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'place-old-other', 'place', 'beijing', 'other', '旧写入', '地点', '',
        'https://example.com/old.webp', CURRENT_TIMESTAMP
      )
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'food-old-hotpot', 'food', 'beijing', 'hotpot', '旧火锅', '火锅', '',
        'https://example.com/old-food.webp', CURRENT_TIMESTAMP
      )
    `)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`
      INSERT INTO "crush_date_content_items" (
        "id", "content_type", "city_code", "category_id", "name", "type",
        "comment", "image", "updated_at"
      ) VALUES (
        'place-category-2', 'place', 'beijing', '2', '公园', '户外', '',
        'https://example.com/park.webp', CURRENT_TIMESTAMP
      )
    `)).resolves.toMatchObject({ rowCount: 1 });
  });
});
