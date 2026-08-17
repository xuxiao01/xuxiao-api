import { z } from 'zod';
import {
  cityCodes,
  cityAdcodePrefixes,
  DEFAULT_CITY_CODE,
  DEFAULT_FOOD_CATEGORY_ID,
  DEFAULT_PLACE_CATEGORY_ID,
  foodCategoryFilterIds,
  foodCategoryIds,
  placeCategoryFilterIds,
  placeCategoryIds,
} from './content-item.config';

const poiProviderSchema = z.literal('tencent');
const poiIdSchema = z.string().trim().min(1, 'poiId 不能为空').max(100);
const poiTitleSchema = z.string().trim().min(1, 'poiTitle 不能为空').max(200);
const poiAddressSchema = z.string().trim().min(1, 'poiAddress 不能为空').max(500);
const nonEmptyCoordinate = (value: unknown) => (
  typeof value === 'string' && value.trim() === '' ? Number.NaN : value
);
const poiLatitudeSchema = z.preprocess(
  nonEmptyCoordinate,
  z.coerce.number().finite().min(-90).max(90),
);
const poiLongitudeSchema = z.preprocess(
  nonEmptyCoordinate,
  z.coerce.number().finite().min(-180).max(180),
);
const poiAdcodeSchema = z.string().trim().min(1, 'poiAdcode 不能为空').max(20);

const createLocationShape = {
  poiProvider: poiProviderSchema.optional(),
  poiId: poiIdSchema.optional(),
  poiTitle: poiTitleSchema.optional(),
  poiAddress: poiAddressSchema.optional(),
  poiLatitude: poiLatitudeSchema.optional(),
  poiLongitude: poiLongitudeSchema.optional(),
  poiAdcode: poiAdcodeSchema.optional(),
};

export const contentLocationSchema = z.object({
  provider: poiProviderSchema,
  poiId: poiIdSchema,
  title: poiTitleSchema,
  address: poiAddressSchema,
  latitude: poiLatitudeSchema,
  longitude: poiLongitudeSchema,
  adcode: poiAdcodeSchema,
}).strict();

function adcodeMatchesCity(
  cityCode: keyof typeof cityAdcodePrefixes,
  adcode: string,
) {
  return adcode.startsWith(cityAdcodePrefixes[cityCode]);
}

const createContentItemShape = {
  cityCode: z.enum(cityCodes).default(DEFAULT_CITY_CODE),
  name: z.string().trim().min(1, 'name 不能为空'),
  type: z.string().trim().min(1, 'type 不能为空'),
  comment: z.string().trim(),
  ...createLocationShape,
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
]).superRefine((input, context) => {
  const locationValues = [
    input.poiProvider,
    input.poiId,
    input.poiTitle,
    input.poiAddress,
    input.poiLatitude,
    input.poiLongitude,
    input.poiAdcode,
  ];
  const providedCount = locationValues.filter((value) => value !== undefined).length;

  if (providedCount > 0 && providedCount < locationValues.length) {
    context.addIssue({
      code: 'custom',
      message: '位置字段必须全部不传或完整传入',
    });
    return;
  }

  if (
    providedCount === locationValues.length
    && input.poiAdcode
    && !adcodeMatchesCity(input.cityCode, input.poiAdcode)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['poiAdcode'],
      message: 'poiAdcode 与 cityCode 不匹配',
    });
  }
});

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

export const updateLocationSchema = z.object({
  location: contentLocationSchema.nullable(),
}).strict();
