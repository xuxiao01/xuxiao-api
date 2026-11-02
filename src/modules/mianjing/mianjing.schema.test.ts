import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mianjingConfigSchema } from './mianjing.config';
import { safeCount } from './mianjing.mapper';
import {
  createOccurrenceSchema,
  createQuestionSchema,
  idSchema,
  listQuerySchema,
  saveCatalogSchema,
  updateMetaSchema,
  updateOccurrenceSchema,
  updateQuestionSchema,
} from './mianjing.schema';

describe('面经参数和权限配置', () => {
  const id = randomUUID();

  it('默认状态、知识点去重和无来源新增', () => {
    expect(
      createQuestionSchema.parse({
        title: '  并发请求  ',
        category: '手撕',
        tags: ['Promise', ' Promise '],
      }),
    ).toEqual({
      title: '并发请求',
      category: '手撕',
      tags: ['Promise'],
      priority: '中',
      mastery: '模糊',
      organized: false,
    });
  });

  it('新增题目来源只能省略或完整填写', () => {
    const base = { title: '题目', category: '八股' };
    expect(
      createQuestionSchema.parse({
        ...base,
        source: { companyId: id, recruitmentType: '暑期', round: '二面' },
      }).source,
    ).toEqual({ companyId: id, recruitmentType: '暑期', round: '二面' });
    for (const source of [
      null,
      {},
      { companyId: id },
      { companyId: id, recruitmentType: '暑期' },
      { companyId: id, recruitmentType: '春招', round: '四面' },
    ]) {
      expect(createQuestionSchema.safeParse({ ...base, source }).success).toBe(false);
    }
  });

  it('快速记录仅接受公司和内容，保留内部换行', () => {
    expect(
      createOccurrenceSchema.parse({
        companyId: id,
        content: '  变形\n追问  ',
      }),
    ).toEqual({
      companyId: id,
      content: '变形\n追问',
    });
    for (const body of [
      { companyId: id, content: ' \n ' },
      { content: '内容' },
      { companyId: id, content: '内容', round: '一面' },
      { companyId: id, content: 'a'.repeat(200001) },
    ]) {
      expect(createOccurrenceSchema.safeParse(body).success).toBe(false);
    }
    expect(updateOccurrenceSchema.parse({ content: '' })).toEqual({
      content: '',
    });
    expect(updateOccurrenceSchema.safeParse({ content: '内容', followups: '旧字段' }).success).toBe(
      false,
    );
  });

  it('公司 ID 统一大小写并去重，允许清空标签', () => {
    expect(idSchema.parse(id.toUpperCase())).toBe(id);
    expect(updateMetaSchema.parse({ companyIds: [id.toUpperCase(), id] }).companyIds).toEqual([id]);
    expect(updateMetaSchema.parse({ companyIds: [] })).toEqual({
      companyIds: [],
    });
  });

  it.each([-1, 0.1, Number.MAX_SAFE_INTEGER + 1, '3', null])('拒绝非法总次数 %s', (totalCount) => {
    expect(updateMetaSchema.safeParse({ totalCount }).success).toBe(false);
  });

  it('只允许修改指定字段，不接受旧字段和版本字段', () => {
    for (const body of [
      {},
      { baseCount: 2 },
      { version: 1 },
      { totalCount: 2, expectedVersion: 1 },
    ]) {
      expect(updateMetaSchema.safeParse(body).success).toBe(false);
    }
    expect(updateQuestionSchema.safeParse({}).success).toBe(false);
    expect(updateQuestionSchema.safeParse({ notes: '笔记' }).success).toBe(false);
    expect(updateQuestionSchema.parse({ organized: true, title: '  新题目 ' })).toEqual({
      organized: true,
      title: '新题目',
    });
  });

  it('公司配置去空白、校验重名和重复ID，保留黑白配色', () => {
    const item = { id, name: ' 百度 ', palette: 'white', enabled: true };
    expect(saveCatalogSchema.parse({ items: [item] }).items[0].name).toBe('百度');
    expect(
      saveCatalogSchema.parse({ items: [{ ...item, palette: 'black' }] }).items[0].palette,
    ).toBe('black');
    expect(
      saveCatalogSchema.safeParse({
        items: [item, { ...item, id: randomUUID(), name: '百度' }],
      }).success,
    ).toBe(false);
    expect(
      saveCatalogSchema.safeParse({
        items: [item, { ...item, id: id.toUpperCase(), name: '腾讯' }],
      }).success,
    ).toBe(false);
    expect(saveCatalogSchema.safeParse({ items: [{ ...item, name: ' ' }] }).success).toBe(false);
    expect(saveCatalogSchema.safeParse({ items: [], expectedRevision: 0 }).success).toBe(false);
  });

  it('分页、排序和组合筛选严格解析', () => {
    expect(listQuerySchema.parse({})).toEqual({
      search: '',
      sort: 'priority',
      page: 1,
      pageSize: 20,
    });
    expect(
      listQuerySchema.parse({
        company: id,
        search: '  并发 PROMISE ',
        category: '手撕',
        mastery: '不会',
        organized: 'false',
        sort: 'count',
        page: '2',
        pageSize: '50',
      }),
    ).toMatchObject({
      search: '并发 PROMISE',
      organized: false,
      page: 2,
      pageSize: 50,
    });
    expect(
      listQuerySchema.parse({ category: '', company: '', mastery: '' }).company,
    ).toBeUndefined();
    for (const query of [
      { page: '0' },
      { page: '1.5' },
      { pageSize: '100' },
      { company: 'bad-id' },
      { organized: '1' },
      { category: ['八股'] },
      { sort: 'unknown' },
    ]) {
      expect(listQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it('计数安全转换，防止 BigInt JSON 错误和超范围', () => {
    expect(safeCount(0n)).toBe(0);
    expect(safeCount(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => safeCount(-1n)).toThrow();
    expect(() => safeCount(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
  });

  it('未配置管理员则不授予权限，非法配置拒绝', () => {
    expect(mianjingConfigSchema.parse({})).toEqual({});
    expect(
      mianjingConfigSchema.parse({ MIANJING_ADMIN_USER_ID: '' }).MIANJING_ADMIN_USER_ID,
    ).toBeUndefined();
    expect(mianjingConfigSchema.parse({ MIANJING_ADMIN_USER_ID: '3' }).MIANJING_ADMIN_USER_ID).toBe(
      3,
    );
    for (const value of ['0', '-1', '1.5', 'abc', '2147483648']) {
      expect(mianjingConfigSchema.safeParse({ MIANJING_ADMIN_USER_ID: value }).success).toBe(false);
    }
  });
});
