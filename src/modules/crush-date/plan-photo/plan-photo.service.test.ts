import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CrushDatePlanStatus } from '../../../generated/client';
import { AppError } from '../../../utils/app-error';

const mocks = vi.hoisted(() => {
  const rootPlan = {
    findUnique: vi.fn(),
  };
  const rootPhoto = {
    findMany: vi.fn(),
  };
  const transactionPlan = {
    findUnique: vi.fn(),
  };
  const transactionPhoto = {
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };
  const transactionQueryRaw = vi.fn();
  const prisma = {
    $transaction: vi.fn(),
    crushDatePlan: rootPlan,
    crushDatePlanPhoto: rootPhoto,
  };
  const uploadImageAtPath = vi.fn();
  const deleteImage = vi.fn();
  const buildPublicUrl = vi.fn((objectKey: string) => `https://oss.example.com/${objectKey}`);

  return {
    buildPublicUrl,
    deleteImage,
    prisma,
    rootPhoto,
    rootPlan,
    transactionPhoto,
    transactionPlan,
    transactionQueryRaw,
    uploadImageAtPath,
  };
});

vi.mock('../../../lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('../upload/upload.service', () => ({
  buildPublicUrl: mocks.buildPublicUrl,
  deleteImage: mocks.deleteImage,
  uploadImageAtPath: mocks.uploadImageAtPath,
}));

import { reorderPlanPhotosSchema } from './plan-photo.schema';
import * as planPhotoService from './plan-photo.service';

const planId = 'plan-completed-1';
const createdAt = new Date('2026-07-24T08:30:00.000Z');

function createPhoto(id: string, sortOrder: number) {
  return {
    id,
    planId,
    objectKey: `crush-date/plan-photos/${planId}/${id}.jpg`,
    sortOrder,
    createdAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactionQueryRaw.mockResolvedValue([{ id: planId }]);
  mocks.prisma.$transaction.mockImplementation(async (callback: unknown) => {
    if (typeof callback !== 'function') {
      throw new Error('不支持的事务调用');
    }
    return callback({
      $queryRaw: mocks.transactionQueryRaw,
      crushDatePlan: mocks.transactionPlan,
      crushDatePlanPhoto: mocks.transactionPhoto,
    });
  });
  mocks.uploadImageAtPath.mockImplementation(async (input) => ({
    objectKey: `${input.objectKeyWithoutExtension}.jpg`,
    url: `https://oss.example.com/${input.objectKeyWithoutExtension}.jpg`,
  }));
  mocks.deleteImage.mockResolvedValue(undefined);
});

describe('create', () => {
  it('为 completed 计划上传照片并自动追加顺序', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
      _count: { photos: 1 },
    });
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.count.mockResolvedValue(1);
    mocks.transactionPhoto.aggregate.mockResolvedValue({
      _max: { sortOrder: 0 },
    });
    mocks.transactionPhoto.create.mockImplementation(async ({ data }) => ({
      ...data,
      createdAt,
    }));

    const result = await planPhotoService.create(planId, {
      buffer: Buffer.from('image'),
      mimeType: 'image/jpeg',
    });

    expect(mocks.uploadImageAtPath).toHaveBeenCalledWith({
      objectKeyWithoutExtension: expect.stringMatching(
        new RegExp(`^crush-date/plan-photos/${planId}/photo-`),
      ),
      buffer: expect.any(Buffer),
      mimeType: 'image/jpeg',
    });
    expect(mocks.transactionPhoto.create).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(/^photo-/),
        planId,
        objectKey: expect.stringMatching(/\.jpg$/),
        sortOrder: 1,
      },
    });
    expect(result).toMatchObject({
      id: expect.stringMatching(/^photo-/),
      url: expect.stringContaining(`crush-date/plan-photos/${planId}/photo-`),
      sortOrder: 1,
      createdAt: createdAt.toISOString(),
    });
  });

  it('非 completed 计划不能上传', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.ACTIVE,
      _count: { photos: 0 },
    });

    await expect(planPhotoService.create(planId, {
      buffer: Buffer.from('image'),
      mimeType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '只有过去的计划可以上传照片',
    });
    expect(mocks.uploadImageAtPath).not.toHaveBeenCalled();
  });

  it('达到 9 张上限时不能继续上传', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
      _count: { photos: 9 },
    });

    await expect(planPhotoService.create(planId, {
      buffer: Buffer.from('image'),
      mimeType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '每个计划最多上传 9 张照片',
    });
    expect(mocks.uploadImageAtPath).not.toHaveBeenCalled();
  });

  it('并发复查发现已满 9 张时清理刚上传的 OSS 文件', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
      _count: { photos: 8 },
    });
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.count.mockResolvedValue(9);

    await expect(planPhotoService.create(planId, {
      buffer: Buffer.from('image'),
      mimeType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '每个计划最多上传 9 张照片',
    });
    expect(mocks.deleteImage).toHaveBeenCalledWith(
      expect.stringContaining(`crush-date/plan-photos/${planId}/photo-`),
    );
  });

  it('数据库写入失败时清理刚上传的 OSS 文件', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
      _count: { photos: 0 },
    });
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.count.mockResolvedValue(0);
    mocks.transactionPhoto.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    mocks.transactionPhoto.create.mockRejectedValue(new Error('database unavailable'));

    await expect(planPhotoService.create(planId, {
      buffer: Buffer.from('image'),
      mimeType: 'image/jpeg',
    })).rejects.toThrow('database unavailable');
    expect(mocks.deleteImage).toHaveBeenCalledTimes(1);
  });

  it('图片格式校验错误直接返回且不写数据库', async () => {
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
      _count: { photos: 0 },
    });
    mocks.uploadImageAtPath.mockRejectedValue(new AppError(400, '图片文件内容与格式不匹配'));

    await expect(planPhotoService.create(planId, {
      buffer: Buffer.from('not-image'),
      mimeType: 'image/jpeg',
    })).rejects.toMatchObject({
      statusCode: 400,
      message: '图片文件内容与格式不匹配',
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('list', () => {
  it('按照照片顺序返回并生成公开 URL', async () => {
    const photos = [createPhoto('photo-1', 0), createPhoto('photo-2', 1)];
    mocks.rootPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.rootPhoto.findMany.mockResolvedValue(photos);

    const result = await planPhotoService.list(planId);

    expect(mocks.rootPhoto.findMany).toHaveBeenCalledWith({
      where: { planId },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
    expect(result.list.map((photo) => photo.id)).toEqual(['photo-1', 'photo-2']);
    expect(result.list[0].url).toBe(
      `https://oss.example.com/${photos[0].objectKey}`,
    );
  });
});

describe('reorder', () => {
  it('按 photoIds 数组顺序更新并返回照片列表', async () => {
    const orderedPhotos = [createPhoto('photo-2', 0), createPhoto('photo-1', 1)];
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.findMany
      .mockResolvedValueOnce([{ id: 'photo-1' }, { id: 'photo-2' }])
      .mockResolvedValueOnce(orderedPhotos);
    mocks.transactionPhoto.updateMany.mockResolvedValue({ count: 1 });

    const result = await planPhotoService.reorder(planId, {
      photoIds: ['photo-2', 'photo-1'],
    });

    expect(mocks.transactionPhoto.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'photo-2', planId },
      data: { sortOrder: 0 },
    });
    expect(mocks.transactionPhoto.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'photo-1', planId },
      data: { sortOrder: 1 },
    });
    expect(result.list.map((photo) => photo.id)).toEqual(['photo-2', 'photo-1']);
  });

  it('photoIds 未完整包含当前照片时返回 400', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.findMany.mockResolvedValue([
      { id: 'photo-1' },
      { id: 'photo-2' },
    ]);

    await expect(planPhotoService.reorder(planId, {
      photoIds: ['photo-1'],
    })).rejects.toMatchObject({
      statusCode: 400,
      message: 'photoIds 必须完整包含当前计划的全部照片',
    });
    expect(mocks.transactionPhoto.updateMany).not.toHaveBeenCalled();
  });
});

describe('reorderPlanPhotosSchema', () => {
  it('拒绝重复照片 ID', () => {
    const result = reorderPlanPhotosSchema.safeParse({
      photoIds: ['photo-1', 'photo-1'],
    });

    expect(result.success).toBe(false);
  });
});

describe('remove', () => {
  it('删除单张照片、清理 OSS 并将剩余顺序整理为连续数字', async () => {
    const objectKey = `crush-date/plan-photos/${planId}/photo-2.jpg`;
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.findFirst.mockResolvedValue({ objectKey });
    mocks.transactionPhoto.delete.mockResolvedValue(createPhoto('photo-2', 1));
    mocks.transactionPhoto.findMany.mockResolvedValue([
      { id: 'photo-1' },
      { id: 'photo-3' },
    ]);
    mocks.transactionPhoto.updateMany.mockResolvedValue({ count: 1 });

    await planPhotoService.remove(planId, 'photo-2');

    expect(mocks.transactionPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: 'photo-2', planId },
      select: { objectKey: true },
    });
    expect(mocks.transactionPhoto.delete).toHaveBeenCalledWith({
      where: { id: 'photo-2' },
    });
    expect(mocks.transactionPhoto.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'photo-1', planId },
      data: { sortOrder: 0 },
    });
    expect(mocks.transactionPhoto.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'photo-3', planId },
      data: { sortOrder: 1 },
    });
    expect(mocks.deleteImage).toHaveBeenCalledWith(objectKey);
  });

  it('照片不存在或不属于该计划时返回 404', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.findFirst.mockResolvedValue(null);

    await expect(
      planPhotoService.remove(planId, 'photo-other'),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: '照片不存在',
    });
    expect(mocks.transactionPhoto.delete).not.toHaveBeenCalled();
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });

  it('非 completed 计划不能删除精选照片', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.ACTIVE,
    });

    await expect(
      planPhotoService.remove(planId, 'photo-1'),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: '只有过去的计划可以管理照片',
    });
    expect(mocks.transactionPhoto.findFirst).not.toHaveBeenCalled();
  });

  it('OSS 删除失败不影响照片数据库删除成功', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const objectKey = `crush-date/plan-photos/${planId}/photo-1.jpg`;
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });
    mocks.transactionPhoto.findFirst.mockResolvedValue({ objectKey });
    mocks.transactionPhoto.delete.mockResolvedValue(createPhoto('photo-1', 0));
    mocks.transactionPhoto.findMany.mockResolvedValue([]);
    mocks.deleteImage.mockRejectedValue(new Error('OSS unavailable'));

    await expect(
      planPhotoService.remove(planId, 'photo-1'),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
