import { describe, expect, it } from 'vitest';
import {
  createContentItemSchema,
  listFoodsQuerySchema,
  listPlacesQuerySchema,
} from './content-item.schema';

describe('createContentItemSchema', () => {
  const baseInput = {
    contentType: 'food',
    name: '老北京涮肉',
    type: '铜锅涮肉',
    comment: '周末去吃',
  };

  it('兼容旧美食请求并使用北京、数字分类 9 作为默认值', () => {
    expect(createContentItemSchema.parse(baseInput)).toMatchObject({
      cityCode: 'beijing',
      categoryId: '9',
    });
  });

  it.each([
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
  ])('接受美食分类 %s', (categoryId) => {
    expect(createContentItemSchema.safeParse({
      ...baseInput,
      categoryId,
    }).success).toBe(true);
  });

  it('拒绝非法城市和分类', () => {
    expect(createContentItemSchema.safeParse({
      ...baseInput,
      cityCode: 'shanghai',
    }).success).toBe(false);
    expect(createContentItemSchema.safeParse({
      ...baseInput,
      categoryId: 'hotpot',
    }).success).toBe(false);
  });

  it('地点缺少分类时默认使用 7', () => {
    expect(createContentItemSchema.parse({
      ...baseInput,
      contentType: 'place',
    })).toMatchObject({ categoryId: '7' });
  });

  it.each(['2', '3', '4', '5', '6', '7'])('地点接受可保存分类 %s', (categoryId) => {
    expect(createContentItemSchema.safeParse({
      ...baseInput,
      contentType: 'place',
      categoryId,
    }).success).toBe(true);
  });

  it('地点拒绝全部筛选值、美食分类和非法数字', () => {
    for (const categoryId of ['1', 'hotpot', '8']) {
      expect(createContentItemSchema.safeParse({
        ...baseInput,
        contentType: 'place',
        categoryId,
      }).success).toBe(false);
    }
  });
});

describe('content item list query schemas', () => {
  it('旧请求保持默认分页并允许最大 100 条', () => {
    expect(listFoodsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(listFoodsQuerySchema.parse({ page: '1', pageSize: '100' })).toMatchObject({
      page: 1,
      pageSize: 100,
    });
  });

  it('严格解析 visited=true/false', () => {
    expect(listFoodsQuerySchema.parse({ visited: 'true' }).visited).toBe(true);
    expect(listFoodsQuerySchema.parse({ visited: 'false' }).visited).toBe(false);
    expect(listFoodsQuerySchema.safeParse({ visited: '1' }).success).toBe(false);
  });

  it('去除 keyword 空白并将空字符串视为未传', () => {
    expect(listFoodsQuerySchema.parse({ keyword: '  牛肉  ' }).keyword).toBe('牛肉');
    expect(listFoodsQuerySchema.parse({ keyword: '   ' }).keyword).toBeUndefined();
    expect(listFoodsQuerySchema.safeParse({ keyword: 'a'.repeat(51) }).success).toBe(false);
  });

  it('美食接受 1 至 9 分类筛选并拒绝旧语义编码', () => {
    expect(listFoodsQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listFoodsQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(listFoodsQuerySchema.safeParse({ cityCode: 'shanghai' }).success).toBe(false);
    for (const categoryId of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(listFoodsQuerySchema.safeParse({ categoryId }).success).toBe(true);
    }
    expect(listFoodsQuerySchema.safeParse({ categoryId: 'hotpot' }).success).toBe(false);
  });

  it('地点接受 1 至 7 分类筛选和关键词', () => {
    for (const categoryId of ['1', '2', '3', '4', '5', '6', '7']) {
      expect(listPlacesQuerySchema.safeParse({ categoryId }).success).toBe(true);
    }
    expect(listPlacesQuerySchema.parse({ keyword: '  公园  ' }).keyword).toBe('公园');
    expect(listPlacesQuerySchema.safeParse({ categoryId: '8' }).success).toBe(false);
    expect(listPlacesQuerySchema.safeParse({ categoryId: 'other' }).success).toBe(false);
  });
});
