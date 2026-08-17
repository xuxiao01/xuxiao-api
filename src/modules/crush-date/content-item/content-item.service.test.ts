import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CrushDateContentType } from '../../../generated/client';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    crushDateContentItem: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('../upload/upload.service', () => ({
  uploadImage: mocks.uploadImage,
  deleteImage: mocks.deleteImage,
  deleteImageByPublicUrl: vi.fn(),
}));

import * as contentItemService from './content-item.service';

const item = {
  id: 'food-1',
  contentType: CrushDateContentType.FOOD,
  cityCode: 'beijing',
  categoryId: 'hotpot',
  name: '老北京涮肉',
  type: '铜锅涮肉',
  comment: '想吃牛肉',
  image: 'https://example.com/food.webp',
  poiProvider: null,
  poiId: null,
  poiTitle: null,
  poiAddress: null,
  poiLatitude: null,
  poiLongitude: null,
  poiAdcode: null,
  visited: false,
  visitedAt: null,
  createdAt: new Date('2026-08-14T08:00:00.000Z'),
  updatedAt: new Date('2026-08-14T08:00:00.000Z'),
};

const placeItem = {
  ...item,
  id: 'place-1',
  contentType: CrushDateContentType.PLACE,
  categoryId: '3',
  name: '中央大街',
  type: '景点',
  comment: '冬天去打卡',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (operations: unknown[]) => (
    Promise.all(operations)
  ));
});

describe('list content items', () => {
  it('组合应用城市、状态、分类和三个关键词字段，并返回分页元数据', async () => {
    mocks.prisma.crushDateContentItem.findMany.mockResolvedValue([item]);
    mocks.prisma.crushDateContentItem.count.mockResolvedValue(21);

    const result = await contentItemService.list('food', {
      cityCode: 'beijing',
      visited: false,
      categoryId: '3',
      keyword: '牛肉',
      page: 1,
      pageSize: 20,
    });

    const expectedWhere = {
      contentType: CrushDateContentType.FOOD,
      cityCode: 'beijing',
      visited: false,
      categoryId: { in: ['3', 'hotpot'] },
      OR: [
        { name: { contains: '牛肉', mode: 'insensitive' } },
        { type: { contains: '牛肉', mode: 'insensitive' } },
        { comment: { contains: '牛肉', mode: 'insensitive' } },
      ],
    };
    expect(mocks.prisma.crushDateContentItem.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(result).toMatchObject({
      list: [{
        id: item.id,
        contentType: 'food',
        cityCode: 'beijing',
        categoryId: '3',
      }],
      total: 21,
      page: 1,
      pageSize: 20,
      hasMore: true,
    });
  });

  it('吃过按 visitedAt 和 id 稳定排序', async () => {
    mocks.prisma.crushDateContentItem.findMany.mockResolvedValue([]);
    mocks.prisma.crushDateContentItem.count.mockResolvedValue(0);

    await contentItemService.list('food', {
      visited: true,
      page: 2,
      pageSize: 10,
    });

    expect(mocks.prisma.crushDateContentItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { visitedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
        skip: 10,
        take: 10,
      }),
    );
  });

  it('美食全部分类不增加过滤，数字分类兼容旧语义值', async () => {
    mocks.prisma.crushDateContentItem.findMany.mockResolvedValue([]);
    mocks.prisma.crushDateContentItem.count.mockResolvedValue(0);

    await contentItemService.list('food', {
      categoryId: '1',
      page: 1,
      pageSize: 20,
    });
    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ categoryId: undefined }),
    });

    await contentItemService.list('food', {
      categoryId: '9',
      page: 1,
      pageSize: 20,
    });
    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        categoryId: { in: ['9', 'other'] },
      }),
    });
  });

  it('地点组合应用分类和关键词', async () => {
    mocks.prisma.crushDateContentItem.findMany.mockResolvedValue([]);
    mocks.prisma.crushDateContentItem.count.mockResolvedValue(0);

    await contentItemService.list('place', {
      cityCode: 'tianjin',
      visited: false,
      categoryId: '3',
      keyword: '公园',
      page: 1,
      pageSize: 20,
    });

    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenCalledWith({
      where: {
        contentType: CrushDateContentType.PLACE,
        cityCode: 'tianjin',
        visited: false,
        categoryId: '3',
        OR: [
          { name: { contains: '公园', mode: 'insensitive' } },
          { type: { contains: '公园', mode: 'insensitive' } },
          { comment: { contains: '公园', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('地点全部分类不增加过滤，分类 7 兼容旧 other', async () => {
    mocks.prisma.crushDateContentItem.findMany.mockResolvedValue([]);
    mocks.prisma.crushDateContentItem.count.mockResolvedValue(0);

    await contentItemService.list('place', {
      categoryId: '1',
      page: 1,
      pageSize: 20,
    });
    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ categoryId: undefined }),
    });

    await contentItemService.list('place', {
      categoryId: '7',
      page: 1,
      pageSize: 20,
    });
    expect(mocks.prisma.crushDateContentItem.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        categoryId: { in: ['7', 'other'] },
      }),
    });
  });
});

describe('create and detail', () => {
  it('新增内容保存城市和分类', async () => {
    mocks.uploadImage.mockResolvedValue({
      url: item.image,
      objectKey: 'crush-date/foods/image.webp',
    });
    mocks.prisma.crushDateContentItem.create.mockResolvedValue(item);

    const result = await contentItemService.createWithImage({
      contentType: 'food',
      cityCode: 'beijing',
      categoryId: '3',
      name: item.name,
      type: item.type,
      comment: item.comment,
      buffer: Buffer.from('image'),
      mimeType: 'image/webp',
    });

    expect(mocks.prisma.crushDateContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cityCode: 'beijing',
        categoryId: '3',
      }),
    });
    expect(result.categoryId).toBe('3');
    expect(result.location).toBeNull();
  });

  it('新增内容保存并返回完整腾讯位置', async () => {
    const locationItem = {
      ...item,
      poiProvider: 'tencent',
      poiId: 'poi-001',
      poiTitle: '海底捞火锅（国贸店）',
      poiAddress: '北京市朝阳区建国门外大街 1 号',
      poiLatitude: 39.9087,
      poiLongitude: 116.4598,
      poiAdcode: '110105',
    };
    mocks.uploadImage.mockResolvedValue({
      url: item.image,
      objectKey: 'crush-date/foods/image.webp',
    });
    mocks.prisma.crushDateContentItem.create.mockResolvedValue(locationItem);

    const result = await contentItemService.createWithImage({
      contentType: 'food',
      cityCode: 'beijing',
      categoryId: '3',
      name: item.name,
      type: item.type,
      comment: item.comment,
      buffer: Buffer.from('image'),
      mimeType: 'image/webp',
      poiProvider: 'tencent',
      poiId: 'poi-001',
      poiTitle: '海底捞火锅（国贸店）',
      poiAddress: '北京市朝阳区建国门外大街 1 号',
      poiLatitude: 39.9087,
      poiLongitude: 116.4598,
      poiAdcode: '110105',
    });

    expect(mocks.prisma.crushDateContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        poiProvider: 'tencent',
        poiId: 'poi-001',
        poiLatitude: 39.9087,
        poiLongitude: 116.4598,
      }),
    });
    expect(result.location).toEqual({
      provider: 'tencent',
      poiId: 'poi-001',
      title: '海底捞火锅（国贸店）',
      address: '北京市朝阳区建国门外大街 1 号',
      latitude: 39.9087,
      longitude: 116.4598,
      adcode: '110105',
    });
  });

  it('详情只查询 food 类型', async () => {
    mocks.prisma.crushDateContentItem.findFirst.mockResolvedValue(item);

    await expect(contentItemService.getFood(item.id)).resolves.toMatchObject({
      id: item.id,
      contentType: 'food',
    });
    expect(mocks.prisma.crushDateContentItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: item.id,
        contentType: CrushDateContentType.FOOD,
      },
    });
  });

  it('地点 ID 或不存在时详情返回 404', async () => {
    mocks.prisma.crushDateContentItem.findFirst.mockResolvedValue(null);

    await expect(contentItemService.getFood('place-1')).rejects.toMatchObject({
      statusCode: 404,
      message: '美食不存在',
    });
  });

  it('地点详情只查询 place，并将兼容值 other 输出为 7', async () => {
    mocks.prisma.crushDateContentItem.findFirst.mockResolvedValue({
      ...placeItem,
      categoryId: 'other',
    });

    await expect(contentItemService.getPlace(placeItem.id)).resolves.toMatchObject({
      id: placeItem.id,
      contentType: 'place',
      categoryId: '7',
    });
    expect(mocks.prisma.crushDateContentItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: placeItem.id,
        contentType: CrushDateContentType.PLACE,
      },
    });
  });

  it('美食 ID 或不存在时地点详情返回 404', async () => {
    mocks.prisma.crushDateContentItem.findFirst.mockResolvedValue(null);

    await expect(contentItemService.getPlace('food-1')).rejects.toMatchObject({
      statusCode: 404,
      message: '地点不存在',
    });
  });

  it('新增地点保存数字分类', async () => {
    mocks.uploadImage.mockResolvedValue({
      url: placeItem.image,
      objectKey: 'crush-date/places/image.webp',
    });
    mocks.prisma.crushDateContentItem.create.mockResolvedValue(placeItem);

    await contentItemService.createWithImage({
      contentType: 'place',
      cityCode: 'harbin',
      categoryId: '3',
      name: placeItem.name,
      type: placeItem.type,
      comment: placeItem.comment,
      buffer: Buffer.from('image'),
      mimeType: 'image/webp',
    });

    expect(mocks.prisma.crushDateContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: CrushDateContentType.PLACE,
        cityCode: 'harbin',
        categoryId: '3',
      }),
    });
  });
});

describe('update location', () => {
  const location = {
    provider: 'tencent' as const,
    poiId: 'poi-001',
    title: '中央大街',
    address: '黑龙江省哈尔滨市道里区中央大街',
    latitude: 45.771,
    longitude: 126.616,
    adcode: '230102',
  };

  it('按内容城市校验并设置位置', async () => {
    const harbinItem = { ...placeItem, cityCode: 'harbin' };
    mocks.prisma.crushDateContentItem.findUnique
      .mockResolvedValueOnce(harbinItem)
      .mockResolvedValueOnce({
        ...harbinItem,
        poiProvider: location.provider,
        poiId: location.poiId,
        poiTitle: location.title,
        poiAddress: location.address,
        poiLatitude: location.latitude,
        poiLongitude: location.longitude,
        poiAdcode: location.adcode,
      });
    mocks.prisma.crushDateContentItem.updateMany.mockResolvedValue({ count: 1 });

    const result = await contentItemService.updateLocation(placeItem.id, { location });

    expect(mocks.prisma.crushDateContentItem.updateMany).toHaveBeenCalledWith({
      where: { id: placeItem.id },
      data: expect.objectContaining({
        poiProvider: 'tencent',
        poiAdcode: '230102',
      }),
    });
    expect(result.location).toEqual(location);
  });

  it('清除全部位置字段', async () => {
    mocks.prisma.crushDateContentItem.findUnique
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(item);
    mocks.prisma.crushDateContentItem.updateMany.mockResolvedValue({ count: 1 });

    await expect(contentItemService.updateLocation(item.id, {
      location: null,
    })).resolves.toMatchObject({ location: null });
    expect(mocks.prisma.crushDateContentItem.updateMany).toHaveBeenCalledWith({
      where: { id: item.id },
      data: {
        poiProvider: null,
        poiId: null,
        poiTitle: null,
        poiAddress: null,
        poiLatitude: null,
        poiLongitude: null,
        poiAdcode: null,
      },
    });
  });

  it('拒绝与内容城市不匹配的位置并处理不存在记录', async () => {
    mocks.prisma.crushDateContentItem.findUnique.mockResolvedValueOnce(item);
    await expect(contentItemService.updateLocation(item.id, {
      location,
    })).rejects.toMatchObject({ statusCode: 400 });

    mocks.prisma.crushDateContentItem.findUnique.mockResolvedValueOnce(null);
    await expect(contentItemService.updateLocation('missing', {
      location: null,
    })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('configuration dictionaries', () => {
  it('返回三个城市、九个美食筛选项和七个地点筛选项', () => {
    expect(contentItemService.listCities().list.map(({ code }) => code)).toEqual([
      'beijing',
      'tianjin',
      'harbin',
    ]);
    expect(contentItemService.listFoodCategories().list).toEqual([
      { id: '1', name: '全部分类', sortOrder: 0, filterOnly: true },
      { id: '2', name: '中餐', sortOrder: 1, filterOnly: false },
      { id: '3', name: '火锅', sortOrder: 2, filterOnly: false },
      { id: '4', name: '烧烤烤肉', sortOrder: 3, filterOnly: false },
      { id: '5', name: '日韩及亚洲料理', sortOrder: 4, filterOnly: false },
      { id: '6', name: '西餐', sortOrder: 5, filterOnly: false },
      { id: '7', name: '小吃快餐', sortOrder: 6, filterOnly: false },
      { id: '8', name: '甜品饮品', sortOrder: 7, filterOnly: false },
      { id: '9', name: '其他', sortOrder: 8, filterOnly: false },
    ]);
    expect(contentItemService.listPlaceCategories().list).toEqual([
      { id: '1', name: '全部分类', sortOrder: 0, filterOnly: true },
      { id: '2', name: '公园户外', sortOrder: 1, filterOnly: false },
      { id: '3', name: '景点打卡', sortOrder: 2, filterOnly: false },
      { id: '4', name: '展览演出', sortOrder: 3, filterOnly: false },
      { id: '5', name: '运动健身', sortOrder: 4, filterOnly: false },
      { id: '6', name: '休闲娱乐', sortOrder: 5, filterOnly: false },
      { id: '7', name: '其他', sortOrder: 6, filterOnly: false },
    ]);
  });
});
