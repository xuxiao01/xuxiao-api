import { z } from 'zod';
import { contentTypes } from '../content-item/content-item.types';
import {
  creatablePlanStatuses,
  planPeriods,
  planScenarios,
} from './plan.types';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

const planDateSchema = z.string().refine(isValidDate, {
  message: 'date 必须是有效的 YYYY-MM-DD 日期',
});

const createPlanItemSchema = z
  .object({
    type: z.enum(contentTypes),
    sourceId: z.string().trim().min(1, 'sourceId 不能为空'),
    period: z.enum(planPeriods),
    note: z.string().trim(),
    order: z.number().int().min(0, 'order 不能小于 0'),
  })
  .strict();

const updatePlanItemSchema = createPlanItemSchema.extend({
  id: z.string().trim().min(1, 'item id 不能为空').optional(),
});

export const createPlanSchema = z
  .object({
    title: z.string().trim().min(1, 'title 不能为空'),
    status: z.enum(creatablePlanStatuses),
    date: planDateSchema.nullable(),
    scenario: z.enum(planScenarios),
    scenarioText: z.string().trim().min(1, 'scenarioText 不能为空'),
    note: z.string().trim(),
    items: z.array(createPlanItemSchema),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === 'active') {
      if (input.date === null) {
        context.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'active 计划的 date 必填',
        });
      } else if (input.date < getShanghaiDate()) {
        context.addIssue({
          code: 'custom',
          path: ['date'],
          message: 'active 计划的 date 不能早于当前日期',
        });
      }
    }

    if (input.status === 'backup' && input.date !== null) {
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'backup 计划的 date 必须为 null',
      });
    }

    const sourceIds = new Set<string>();
    input.items.forEach((item, index) => {
      if (sourceIds.has(item.sourceId)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'sourceId'],
          message: '同一计划中 sourceId 不能重复',
        });
      }
      sourceIds.add(item.sourceId);
    });
  });

export const planParamsSchema = z.object({
  id: z.string().trim().min(1, 'id 不能为空'),
});

export const updatePlanSchema = z
  .object({
    title: z.string().trim().min(1, 'title 不能为空').optional(),
    date: planDateSchema.nullable().optional(),
    scenario: z.enum(planScenarios).optional(),
    scenarioText: z.string().trim().min(1, 'scenarioText 不能为空').optional(),
    note: z.string().trim().optional(),
    items: z.array(updatePlanItemSchema).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (Object.keys(input).length === 0) {
      context.addIssue({
        code: 'custom',
        message: '至少提交一个可修改字段',
      });
    }

    const sourceIds = new Set<string>();
    input.items?.forEach((item, index) => {
      if (sourceIds.has(item.sourceId)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'sourceId'],
          message: '同一计划中 sourceId 不能重复',
        });
      }
      sourceIds.add(item.sourceId);
    });
  });

export const activatePlanSchema = z
  .object({
    date: planDateSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.date < getShanghaiDate()) {
      context.addIssue({
        code: 'custom',
        path: ['date'],
        message: 'date 不能早于当前日期',
      });
    }
  });

export const replanPlanSchema = activatePlanSchema;
