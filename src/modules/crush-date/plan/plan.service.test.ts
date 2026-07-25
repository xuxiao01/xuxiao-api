import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  CrushDateContentType,
  CrushDatePlanPeriod,
  CrushDatePlanScenario,
  CrushDatePlanStatus,
  Prisma,
} from '../../../generated/client';

const mocks = vi.hoisted(() => {
  const transactionPlan = {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const transactionPlanItem = {
    create: vi.fn(),
    createMany: vi.fn(),
  };
  const rootPlan = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  };
  const prisma = {
    $transaction: vi.fn(),
    crushDatePlan: rootPlan,
  };
  const deleteImage = vi.fn();

  return {
    deleteImage,
    prisma,
    rootPlan,
    transactionPlan,
    transactionPlanItem,
  };
});

vi.mock('../../../lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('../upload/upload.service', () => ({
  deleteImage: mocks.deleteImage,
}));

import { updatePlanStatusSchema } from './plan.schema';
import * as planService from './plan.service';

const createdAt = new Date('2026-07-10T08:00:00.000Z');
const updatedAt = new Date('2026-07-10T08:00:00.000Z');
const planItem = {
  id: 'plan-item-1',
  planId: 'plan-backup-1',
  type: CrushDateContentType.PLACE,
  sourceId: 'place-1',
  title: '博物馆',
  image: 'https://example.com/place.jpg',
  period: CrushDatePlanPeriod.MORNING,
  note: '先看展',
  order: 0,
};
const backupPlan = {
  id: 'plan-backup-1',
  title: '下雨天计划',
  status: CrushDatePlanStatus.BACKUP,
  date: null,
  scenario: CrushDatePlanScenario.RAINY,
  scenarioText: '下雨 · 室内',
  note: '记得带伞',
  sourceBackupId: null,
  completedAt: null,
  createdAt,
  updatedAt,
  items: [planItem],
};

function asActivePlan() {
  return {
    ...backupPlan,
    status: CrushDatePlanStatus.ACTIVE,
    date: new Date('2099-07-26T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T09:00:00.000Z'),
  };
}

function asCompletedPlan() {
  return {
    ...asActivePlan(),
    status: CrushDatePlanStatus.COMPLETED,
    completedAt: new Date('2026-07-10T10:00:00.000Z'),
    updatedAt: new Date('2026-07-10T10:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    if (typeof input === 'function') {
      return input({
        crushDatePlan: mocks.transactionPlan,
        crushDatePlanItem: mocks.transactionPlanItem,
      });
    }
    throw new Error('不支持的事务调用');
  });
});

describe('updateStatus: active', () => {
  it('原地将 backup 更新为 active，并保留计划和安排项 ID', async () => {
    const activatedPlan = asActivePlan();
    mocks.transactionPlan.findUnique
      .mockResolvedValueOnce({ status: CrushDatePlanStatus.BACKUP })
      .mockResolvedValueOnce(activatedPlan);
    mocks.transactionPlan.findFirst.mockResolvedValue(null);
    mocks.transactionPlan.updateMany.mockResolvedValue({ count: 1 });

    const result = await planService.updateStatus(backupPlan.id, {
      status: 'active',
      date: '2099-07-26',
    });

    expect(mocks.transactionPlan.updateMany).toHaveBeenCalledWith({
      where: {
        id: backupPlan.id,
        status: CrushDatePlanStatus.BACKUP,
      },
      data: {
        status: CrushDatePlanStatus.ACTIVE,
        date: new Date('2099-07-26T00:00:00.000Z'),
        sourceBackupId: null,
        completedAt: null,
      },
    });
    expect(mocks.transactionPlan.create).not.toHaveBeenCalled();
    expect(mocks.transactionPlanItem.create).not.toHaveBeenCalled();
    expect(mocks.transactionPlanItem.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: backupPlan.id,
      status: 'active',
      date: '2099-07-26',
      title: backupPlan.title,
      scenario: 'rainy',
      scenarioText: backupPlan.scenarioText,
      note: backupPlan.note,
      sourceBackupId: null,
      createdAt: createdAt.toISOString(),
      items: [{
        id: planItem.id,
        sourceId: planItem.sourceId,
        title: planItem.title,
      }],
    });
  });

  it('计划不存在时返回 404', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue(null);

    await expect(planService.updateStatus('missing-plan', {
      status: 'active',
      date: '2099-07-26',
    })).rejects.toMatchObject({
      statusCode: 404,
      message: '计划不存在',
    });
  });

  it('目标计划不是 backup 时返回 409', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.COMPLETED,
    });

    await expect(planService.updateStatus(backupPlan.id, {
      status: 'active',
      date: '2099-07-26',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '只有备用计划可以设为本次计划',
    });
  });

  it('系统中已有 active 时返回 409', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      status: CrushDatePlanStatus.BACKUP,
    });
    mocks.transactionPlan.findFirst.mockResolvedValue({ id: 'plan-active-1' });

    await expect(planService.updateStatus(backupPlan.id, {
      status: 'active',
      date: '2099-07-26',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '系统中已存在本次计划',
    });
  });

  it('状态条件更新失败时返回 409，防止并发重复激活', async () => {
    mocks.transactionPlan.findUnique
      .mockResolvedValueOnce({ status: CrushDatePlanStatus.BACKUP })
      .mockResolvedValueOnce({ status: CrushDatePlanStatus.ACTIVE });
    mocks.transactionPlan.findFirst.mockResolvedValue(null);
    mocks.transactionPlan.updateMany.mockResolvedValue({ count: 0 });

    await expect(planService.updateStatus(backupPlan.id, {
      status: 'active',
      date: '2099-07-26',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '只有备用计划可以设为本次计划',
    });
  });

  it('数据库单 active 唯一约束冲突时返回 409', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
      },
    );
    mocks.prisma.$transaction.mockRejectedValue(error);

    await expect(planService.updateStatus(backupPlan.id, {
      status: 'active',
      date: '2099-07-26',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '系统中已存在本次计划',
    });
  });
});

describe('updatePlanStatusSchema', () => {
  const invalidInputs: Array<[unknown, string]> = [
    [{}, '缺少 status'],
    [{ status: 'active' }, 'active 缺少 date'],
    [{ status: 'active', date: '2026-02-30' }, '无效日期'],
    [{ status: 'active', date: '2000-01-01' }, '过去日期'],
    [{ status: 'completed', date: '2099-07-26' }, 'completed 不接受 date'],
    [{ status: 'backup', date: '2099-07-26' }, 'backup 不接受 date'],
  ];

  it.each(invalidInputs)('%s 校验失败：%s', (input, _description) => {
    expect(updatePlanStatusSchema.safeParse(input).success).toBe(false);
  });

  it('接受带有效日期的 active 状态', () => {
    expect(updatePlanStatusSchema.safeParse({
      status: 'active',
      date: '2099-07-26',
    }).success).toBe(true);
  });

  it('接受不带 date 的 completed 状态', () => {
    expect(updatePlanStatusSchema.safeParse({
      status: 'completed',
    }).success).toBe(true);
  });

  it('接受不带 date 的 backup 状态', () => {
    expect(updatePlanStatusSchema.safeParse({
      status: 'backup',
    }).success).toBe(true);
  });
});

describe('list', () => {
  it('按状态分别返回 active、backup 和 completed 计划', async () => {
    const activePlan = asActivePlan();
    const otherBackup = {
      ...backupPlan,
      id: 'plan-backup-2',
      items: [{ ...planItem, id: 'plan-item-2', planId: 'plan-backup-2' }],
    };
    const completedPlan = {
      ...asCompletedPlan(),
      id: 'plan-completed-1',
      items: [{
        ...planItem,
        id: 'plan-item-completed-1',
        planId: 'plan-completed-1',
      }],
    };
    mocks.rootPlan.findFirst.mockResolvedValue(activePlan);
    mocks.rootPlan.findMany
      .mockResolvedValueOnce([otherBackup])
      .mockResolvedValueOnce([completedPlan]);

    const result = await planService.list();

    expect(result.activePlan?.id).toBe(activePlan.id);
    expect(result.backupPlans.map((plan) => plan.id)).toEqual([otherBackup.id]);
    expect(result.completedPlans.map((plan) => plan.id)).toEqual([completedPlan.id]);
    expect(result.backupPlans).not.toContainEqual(
      expect.objectContaining({ id: activePlan.id }),
    );
    expect(result.completedPlans).not.toContainEqual(
      expect.objectContaining({ id: activePlan.id }),
    );
  });
});

describe('updateStatus: completed', () => {
  it('原地将 active 更新为 completed，并保留计划和安排项 ID', async () => {
    const completedPlan = asCompletedPlan();
    mocks.transactionPlan.updateMany.mockResolvedValue({ count: 1 });
    mocks.transactionPlan.findUnique.mockResolvedValue(completedPlan);

    const result = await planService.updateStatus(backupPlan.id, {
      status: 'completed',
    });

    expect(mocks.transactionPlan.updateMany).toHaveBeenCalledWith({
      where: {
        id: backupPlan.id,
        status: CrushDatePlanStatus.ACTIVE,
      },
      data: {
        status: CrushDatePlanStatus.COMPLETED,
        completedAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({
      id: backupPlan.id,
      status: 'completed',
      items: [{ id: planItem.id }],
    });
    expect(mocks.transactionPlan.create).not.toHaveBeenCalled();
  });
});

describe('updateStatus: backup', () => {
  it('原地将 active 放回 backup，并清空计划日期', async () => {
    const movedBackPlan = {
      ...backupPlan,
      updatedAt: new Date('2026-07-10T11:00:00.000Z'),
    };
    mocks.transactionPlan.updateMany.mockResolvedValue({ count: 1 });
    mocks.transactionPlan.findUnique.mockResolvedValue(movedBackPlan);

    const result = await planService.updateStatus(backupPlan.id, {
      status: 'backup',
    });

    expect(mocks.transactionPlan.updateMany).toHaveBeenCalledWith({
      where: {
        id: backupPlan.id,
        status: CrushDatePlanStatus.ACTIVE,
      },
      data: {
        status: CrushDatePlanStatus.BACKUP,
        date: null,
        completedAt: null,
        sourceBackupId: null,
      },
    });
    expect(result).toMatchObject({
      id: backupPlan.id,
      status: 'backup',
      date: null,
      completedAt: null,
      items: [{ id: planItem.id }],
    });
    expect(mocks.transactionPlan.create).not.toHaveBeenCalled();
  });

  it('非 active 计划不能放回 backup', async () => {
    mocks.transactionPlan.updateMany.mockResolvedValue({ count: 0 });
    mocks.transactionPlan.findUnique.mockResolvedValue({ id: backupPlan.id });

    await expect(planService.updateStatus(backupPlan.id, {
      status: 'backup',
    })).rejects.toMatchObject({
      statusCode: 409,
      message: '只有本次计划可以放回备用计划',
    });
  });
});

describe('remove', () => {
  it('允许删除 completed 计划并清理关联的 OSS 照片', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue({
      photos: [
        { objectKey: 'crush-date/plan-photos/plan-1/photo-1.jpg' },
        { objectKey: 'crush-date/plan-photos/plan-1/photo-2.webp' },
      ],
    });
    mocks.transactionPlan.deleteMany.mockResolvedValue({ count: 1 });
    mocks.deleteImage.mockResolvedValue(undefined);

    await planService.remove('plan-1');

    expect(mocks.transactionPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      select: {
        photos: {
          select: { objectKey: true },
        },
      },
    });
    expect(mocks.transactionPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
    });
    expect(mocks.deleteImage).toHaveBeenCalledTimes(2);
  });

  it('OSS 照片删除失败不影响计划删除成功', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.transactionPlan.findUnique.mockResolvedValue({
      photos: [{ objectKey: 'crush-date/plan-photos/plan-1/photo-1.jpg' }],
    });
    mocks.transactionPlan.deleteMany.mockResolvedValue({ count: 1 });
    mocks.deleteImage.mockRejectedValue(new Error('OSS unavailable'));

    await expect(planService.remove('plan-1')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('计划不存在时返回 404', async () => {
    mocks.transactionPlan.findUnique.mockResolvedValue(null);

    await expect(planService.remove('missing-plan')).rejects.toMatchObject({
      statusCode: 404,
      message: '计划不存在',
    });
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });
});
