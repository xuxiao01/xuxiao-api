import {
  CrushDateContentType,
  CrushDatePlanPeriod,
  CrushDatePlanScenario,
  CrushDatePlanStatus,
  Prisma,
} from '../../../generated/client';
import type {
  PlanItemType,
  PlanPeriod,
  PlanResponse,
  PlanScenario,
  PlanStatus,
} from './plan.types';

export type PlanWithItems = Prisma.CrushDatePlanGetPayload<{
  include: { items: true };
}>;

const responseStatuses: Record<CrushDatePlanStatus, PlanStatus> = {
  [CrushDatePlanStatus.ACTIVE]: 'active',
  [CrushDatePlanStatus.BACKUP]: 'backup',
  [CrushDatePlanStatus.COMPLETED]: 'completed',
};

const responseScenarios: Record<CrushDatePlanScenario, PlanScenario> = {
  [CrushDatePlanScenario.HOT]: 'hot',
  [CrushDatePlanScenario.COLD]: 'cold',
  [CrushDatePlanScenario.RAINY]: 'rainy',
  [CrushDatePlanScenario.SUNNY]: 'sunny',
  [CrushDatePlanScenario.FREE]: 'free',
};

const responsePeriods: Record<CrushDatePlanPeriod, PlanPeriod> = {
  [CrushDatePlanPeriod.MORNING]: 'morning',
  [CrushDatePlanPeriod.NOON]: 'noon',
  [CrushDatePlanPeriod.AFTERNOON]: 'afternoon',
  [CrushDatePlanPeriod.EVENING]: 'evening',
};

const responseContentTypes: Record<CrushDateContentType, PlanItemType> = {
  [CrushDateContentType.FOOD]: 'food',
  [CrushDateContentType.PLACE]: 'place',
};

const periodSortOrder: Record<PlanPeriod, number> = {
  morning: 0,
  noon: 1,
  afternoon: 2,
  evening: 3,
};

export function toPlanResponse(plan: PlanWithItems): PlanResponse {
  const items = plan.items
    .map((item) => ({
      id: item.id,
      type: responseContentTypes[item.type],
      sourceId: item.sourceId,
      title: item.title,
      image: item.image,
      period: responsePeriods[item.period],
      note: item.note,
      order: item.order,
    }))
    .sort((left, right) => (
      periodSortOrder[left.period] - periodSortOrder[right.period]
      || left.order - right.order
    ));

  return {
    id: plan.id,
    title: plan.title,
    status: responseStatuses[plan.status],
    date: plan.date?.toISOString().slice(0, 10) ?? null,
    scenario: responseScenarios[plan.scenario],
    scenarioText: plan.scenarioText,
    note: plan.note,
    items,
    sourceBackupId: plan.sourceBackupId,
    completedAt: plan.completedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}
