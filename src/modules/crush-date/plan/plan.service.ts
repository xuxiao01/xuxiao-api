import { randomUUID } from 'node:crypto';
import {
  CrushDateContentType,
  CrushDatePlanPeriod,
  CrushDatePlanScenario,
  CrushDatePlanStatus,
  Prisma,
  type CrushDatePlanItem,
} from '../../../generated/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/app-error';
import { toPlanResponse } from './plan.mapper';
import type {
  ActivatePlanInput,
  CreatePlanInput,
  CreatePlanItemInput,
  PlanItemType,
  PlanListResponse,
  PlanPeriod,
  PlanResponse,
  ReplanPlanInput,
  PlanScenario,
  UpdatePlanInput,
  UpdatePlanItemInput,
} from './plan.types';

const databaseContentTypes: Record<PlanItemType, CrushDateContentType> = {
  food: CrushDateContentType.FOOD,
  place: CrushDateContentType.PLACE,
};

const databaseScenarios: Record<PlanScenario, CrushDatePlanScenario> = {
  hot: CrushDatePlanScenario.HOT,
  cold: CrushDatePlanScenario.COLD,
  rainy: CrushDatePlanScenario.RAINY,
  sunny: CrushDatePlanScenario.SUNNY,
  free: CrushDatePlanScenario.FREE,
};

const databasePeriods: Record<PlanPeriod, CrushDatePlanPeriod> = {
  morning: CrushDatePlanPeriod.MORNING,
  noon: CrushDatePlanPeriod.NOON,
  afternoon: CrushDatePlanPeriod.AFTERNOON,
  evening: CrushDatePlanPeriod.EVENING,
};

function normalizeItemOrder<T extends CreatePlanItemInput>(items: T[]): T[] {
  const normalized = new Map<number, number>();

  Object.keys(databasePeriods).forEach((period) => {
    items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.period === period)
      .sort((left, right) => left.item.order - right.item.order || left.index - right.index)
      .forEach(({ index }, order) => normalized.set(index, order));
  });

  return items.map((item, index) => ({
    ...item,
    order: normalized.get(index) ?? 0,
  }));
}

function getShanghaiDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function buildUpdatedPlanItems(
  transaction: Prisma.TransactionClient,
  planId: string,
  items: UpdatePlanItemInput[],
) {
  const existingItems = await transaction.crushDatePlanItem.findMany({
    where: { planId },
  });
  const existingItemsById = new Map(existingItems.map((item) => [item.id, item]));

  items.forEach((item) => {
    if (item.id && !existingItemsById.has(item.id)) {
      throw new AppError(400, `安排项 ${item.id} 不属于当前计划`);
    }
  });

  const normalizedItems = normalizeItemOrder(items);
  const sourceIdsToRefresh = normalizedItems
    .filter((item) => {
      if (!item.id) {
        return true;
      }
      const existingItem = existingItemsById.get(item.id);
      return !existingItem
        || existingItem.sourceId !== item.sourceId
        || existingItem.type !== databaseContentTypes[item.type];
    })
    .map((item) => item.sourceId);
  const sourceItems = await transaction.crushDateContentItem.findMany({
    where: { id: { in: sourceIdsToRefresh } },
  });
  const sourceItemsById = new Map(sourceItems.map((item) => [item.id, item]));

  return normalizedItems.map((item) => {
    const existingItem: CrushDatePlanItem | undefined = item.id
      ? existingItemsById.get(item.id)
      : undefined;
    const canKeepSnapshot = existingItem
      && existingItem.sourceId === item.sourceId
      && existingItem.type === databaseContentTypes[item.type];
    const sourceItem = canKeepSnapshot ? undefined : sourceItemsById.get(item.sourceId);

    if (!canKeepSnapshot && !sourceItem) {
      throw new AppError(400, `sourceId ${item.sourceId} 不存在`);
    }
    if (sourceItem && sourceItem.contentType !== databaseContentTypes[item.type]) {
      throw new AppError(400, `sourceId ${item.sourceId} 与 type 不匹配`);
    }

    return {
      id: existingItem?.id ?? `plan-item-${randomUUID()}`,
      type: databaseContentTypes[item.type],
      sourceId: item.sourceId,
      title: existingItem && canKeepSnapshot ? existingItem.title : sourceItem!.name,
      image: existingItem && canKeepSnapshot ? existingItem.image : sourceItem!.image,
      period: databasePeriods[item.period],
      note: item.note,
      order: item.order,
    };
  });
}

export async function create(input: CreatePlanInput): Promise<PlanResponse> {
  try {
    const plan = await prisma.$transaction(async (transaction) => {
      if (input.status === 'active') {
        const activePlan = await transaction.crushDatePlan.findFirst({
          where: { status: CrushDatePlanStatus.ACTIVE },
          select: { id: true },
        });
        if (activePlan) {
          throw new AppError(409, '系统中已存在本次计划');
        }
      }

      const sourceIds = input.items.map((item) => item.sourceId);
      const sourceItems = await transaction.crushDateContentItem.findMany({
        where: { id: { in: sourceIds } },
      });
      const sourceItemsById = new Map(sourceItems.map((item) => [item.id, item]));
      const normalizedItems = normalizeItemOrder(input.items);

      const planItems = normalizedItems.map((item) => {
        const sourceItem = sourceItemsById.get(item.sourceId);
        if (!sourceItem) {
          throw new AppError(400, `sourceId ${item.sourceId} 不存在`);
        }
        if (sourceItem.contentType !== databaseContentTypes[item.type]) {
          throw new AppError(400, `sourceId ${item.sourceId} 与 type 不匹配`);
        }

        return {
          id: `plan-item-${randomUUID()}`,
          type: databaseContentTypes[item.type],
          sourceId: item.sourceId,
          title: sourceItem.name,
          image: sourceItem.image,
          period: databasePeriods[item.period],
          note: item.note,
          order: item.order,
        };
      });

      return transaction.crushDatePlan.create({
        data: {
          id: `plan-${randomUUID()}`,
          title: input.title,
          status: input.status === 'active'
            ? CrushDatePlanStatus.ACTIVE
            : CrushDatePlanStatus.BACKUP,
          date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : null,
          scenario: databaseScenarios[input.scenario],
          scenarioText: input.scenarioText,
          note: input.note,
          items: {
            create: planItems,
          },
        },
        include: { items: true },
      });
    });

    return toPlanResponse(plan);
  } catch (error) {
    if (
      input.status === 'active'
      && error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      throw new AppError(409, '系统中已存在本次计划');
    }
    throw error;
  }
}

export async function list(): Promise<PlanListResponse> {
  const include = { items: true } as const;
  const [activePlan, backupPlans, completedPlans] = await prisma.$transaction([
    prisma.crushDatePlan.findFirst({
      where: { status: CrushDatePlanStatus.ACTIVE },
      include,
    }),
    prisma.crushDatePlan.findMany({
      where: { status: CrushDatePlanStatus.BACKUP },
      orderBy: { createdAt: 'desc' },
      include,
    }),
    prisma.crushDatePlan.findMany({
      where: { status: CrushDatePlanStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      include,
    }),
  ]);

  return {
    activePlan: activePlan ? toPlanResponse(activePlan) : null,
    backupPlans: backupPlans.map(toPlanResponse),
    completedPlans: completedPlans.map(toPlanResponse),
  };
}

export async function getById(id: string): Promise<PlanResponse> {
  const plan = await prisma.crushDatePlan.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!plan) {
    throw new AppError(404, '计划不存在');
  }

  return toPlanResponse(plan);
}

export async function update(
  id: string,
  input: UpdatePlanInput,
): Promise<PlanResponse> {
  const plan = await prisma.$transaction(async (transaction) => {
    const existingPlan = await transaction.crushDatePlan.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existingPlan) {
      throw new AppError(404, '计划不存在');
    }
    if (existingPlan.status === CrushDatePlanStatus.COMPLETED) {
      throw new AppError(409, '过去的计划不能修改');
    }

    if (input.date !== undefined) {
      if (existingPlan.status === CrushDatePlanStatus.ACTIVE) {
        if (input.date === null) {
          throw new AppError(400, 'active 计划的 date 必填');
        }
        if (input.date < getShanghaiDate()) {
          throw new AppError(400, 'active 计划的 date 不能早于当前日期');
        }
      } else if (input.date !== null) {
        throw new AppError(400, 'backup 计划的 date 必须为 null');
      }
    }

    const updatedItems = input.items
      ? await buildUpdatedPlanItems(transaction, id, input.items)
      : undefined;
    if (updatedItems) {
      await transaction.crushDatePlanItem.deleteMany({
        where: { planId: id },
      });
    }

    const data: Prisma.CrushDatePlanUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.date !== undefined) {
      data.date = input.date ? new Date(`${input.date}T00:00:00.000Z`) : null;
    }
    if (input.scenario !== undefined) {
      data.scenario = databaseScenarios[input.scenario];
    }
    if (input.scenarioText !== undefined) data.scenarioText = input.scenarioText;
    if (input.note !== undefined) data.note = input.note;
    if (updatedItems) {
      data.items = {
        create: updatedItems,
      };
    }

    return transaction.crushDatePlan.update({
      where: { id },
      data,
      include: { items: true },
    });
  });

  return toPlanResponse(plan);
}

export async function remove(id: string): Promise<void> {
  const plan = await prisma.crushDatePlan.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!plan) {
    throw new AppError(404, '计划不存在');
  }
  if (plan.status === CrushDatePlanStatus.COMPLETED) {
    throw new AppError(409, '过去的计划不能删除');
  }

  const result = await prisma.crushDatePlan.deleteMany({
    where: { id },
  });
  if (result.count === 0) {
    throw new AppError(404, '计划不存在');
  }
}

export async function activate(
  id: string,
  input: ActivatePlanInput,
): Promise<PlanResponse> {
  try {
    const plan = await prisma.$transaction(async (transaction) => {
      const sourcePlan = await transaction.crushDatePlan.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sourcePlan) {
        throw new AppError(404, '计划不存在');
      }
      if (sourcePlan.status !== CrushDatePlanStatus.BACKUP) {
        throw new AppError(409, '只有备用计划可以设为本次计划');
      }

      const activePlan = await transaction.crushDatePlan.findFirst({
        where: { status: CrushDatePlanStatus.ACTIVE },
        select: { id: true },
      });
      if (activePlan) {
        throw new AppError(409, '系统中已存在本次计划');
      }

      return transaction.crushDatePlan.create({
        data: {
          id: `plan-${randomUUID()}`,
          title: sourcePlan.title,
          status: CrushDatePlanStatus.ACTIVE,
          date: new Date(`${input.date}T00:00:00.000Z`),
          scenario: sourcePlan.scenario,
          scenarioText: sourcePlan.scenarioText,
          note: sourcePlan.note,
          sourceBackup: {
            connect: { id: sourcePlan.id },
          },
          items: {
            create: sourcePlan.items.map((item) => ({
              id: `plan-item-${randomUUID()}`,
              type: item.type,
              sourceId: item.sourceId,
              title: item.title,
              image: item.image,
              period: item.period,
              note: item.note,
              order: item.order,
            })),
          },
        },
        include: { items: true },
      });
    });

    return toPlanResponse(plan);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      throw new AppError(409, '系统中已存在本次计划');
    }
    throw error;
  }
}

export async function complete(id: string): Promise<PlanResponse> {
  const plan = await prisma.$transaction(async (transaction) => {
    const result = await transaction.crushDatePlan.updateMany({
      where: {
        id,
        status: CrushDatePlanStatus.ACTIVE,
      },
      data: {
        status: CrushDatePlanStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existingPlan = await transaction.crushDatePlan.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existingPlan) {
        throw new AppError(404, '计划不存在');
      }
      throw new AppError(409, '只有本次计划可以完成');
    }

    const completedPlan = await transaction.crushDatePlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!completedPlan) {
      throw new AppError(404, '计划不存在');
    }
    return completedPlan;
  });

  return toPlanResponse(plan);
}

export async function replan(
  id: string,
  input: ReplanPlanInput,
): Promise<PlanResponse> {
  try {
    const plan = await prisma.$transaction(async (transaction) => {
      const sourcePlan = await transaction.crushDatePlan.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!sourcePlan) {
        throw new AppError(404, '计划不存在');
      }
      if (sourcePlan.status !== CrushDatePlanStatus.COMPLETED) {
        throw new AppError(409, '只有过去的计划可以再次计划');
      }

      const activePlan = await transaction.crushDatePlan.findFirst({
        where: { status: CrushDatePlanStatus.ACTIVE },
        select: { id: true },
      });
      if (activePlan) {
        throw new AppError(409, '系统中已存在本次计划');
      }

      return transaction.crushDatePlan.create({
        data: {
          id: `plan-${randomUUID()}`,
          title: sourcePlan.title,
          status: CrushDatePlanStatus.ACTIVE,
          date: new Date(`${input.date}T00:00:00.000Z`),
          scenario: sourcePlan.scenario,
          scenarioText: sourcePlan.scenarioText,
          note: sourcePlan.note,
          items: {
            create: sourcePlan.items.map((item) => ({
              id: `plan-item-${randomUUID()}`,
              type: item.type,
              sourceId: item.sourceId,
              title: item.title,
              image: item.image,
              period: item.period,
              note: item.note,
              order: item.order,
            })),
          },
        },
        include: { items: true },
      });
    });

    return toPlanResponse(plan);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      throw new AppError(409, '系统中已存在本次计划');
    }
    throw error;
  }
}
