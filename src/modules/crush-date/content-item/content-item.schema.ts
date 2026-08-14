import { z } from 'zod';
import {
  cityCodes,
  DEFAULT_CITY_CODE,
  DEFAULT_FOOD_CATEGORY_ID,
  DEFAULT_PLACE_CATEGORY_ID,
  foodCategoryFilterIds,
  foodCategoryIds,
  placeCategoryFilterIds,
  placeCategoryIds,
} from './content-item.config';

const createContentItemShape = {
  cityCode: z.enum(cityCodes).default(DEFAULT_CITY_CODE),
  name: z.string().trim().min(1, 'name 不能为空'),
  type: z.string().trim().min(1, 'type 不能为空'),
  comment: z.string().trim(),
};

export const createContentItemSchema = z.discriminatedUnion('contentType', [
  z.object({
    contentType: z.literal('food'),
    ...createContentItemShape,
    categoryId: z.enum(foodCategoryIds).default(DEFAULT_FOOD_CATEGORY_ID),
  }).strict(),
  z.object({
    contentType: z.literal('place'),
    ...createContentItemShape,
    categoryId: z.enum(placeCategoryIds).default(DEFAULT_PLACE_CATEGORY_ID),
  }).strict(),
]);

const paginationQueryShape = {
  cityCode: z.enum(cityCodes).optional(),
  visited: z.enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const listFoodsQuerySchema = z
  .object({
    ...paginationQueryShape,
    categoryId: z.enum(foodCategoryFilterIds).optional(),
    keyword: z.string()
      .trim()
      .max(50, 'keyword 不能超过 50 个字符')
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export const listPlacesQuerySchema = z
  .object({
    ...paginationQueryShape,
    categoryId: z.enum(placeCategoryFilterIds).optional(),
    keyword: z.string()
      .trim()
      .max(50, 'keyword 不能超过 50 个字符')
      .transform((value) => value || undefined)
      .optional(),
  })
  .strict();

export const contentItemParamsSchema = z.object({
  id: z.string().trim().min(1, 'id 不能为空'),
});

export const updateVisitedSchema = z
  .object({
    visited: z.boolean(),
  })
  .strict();
