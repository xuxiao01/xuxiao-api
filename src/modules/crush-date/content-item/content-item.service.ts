import { randomUUID } from 'node:crypto';
import {
  CrushDateContentType,
  Prisma,
  type CrushDateContentItem,
} from '../../../generated/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/app-error';
import * as uploadService from '../upload/upload.service';
import {
  cities,
  foodCategories,
  placeCategories,
} from './content-item.config';
import type {
  FoodCategoryId,
  PlaceCategoryId,
} from './content-item.config';
import type {
  ContentItemListResponse,
  ContentItemResponse,
  ContentType,
  CreateContentItemInput,
  CreateContentItemWithImageInput,
  ListContentItemsQuery,
  UpdateVisitedInput,
} from './content-item.types';

const legacyFoodCategoryById: Record<FoodCategoryId, string> = {
  '2': 'chinese',
  '3': 'hotpot',
  '4': 'barbecue',
  '5': 'asian',
  '6': 'western',
  '7': 'snack_fastfood',
  '8': 'dessert_drinks',
  '9': 'other',
};

const foodCategoryIdByLegacy = Object.fromEntries(
  Object.entries(legacyFoodCategoryById).map(([id, legacy]) => [legacy, id]),
) as Record<string, FoodCategoryId>;

const databaseContentTypes: Record<ContentType, CrushDateContentType> = {
  food: CrushDateContentType.FOOD,
  place: CrushDateContentType.PLACE,
};

const responseContentTypes: Record<CrushDateContentType, ContentType> = {
  [CrushDateContentType.FOOD]: 'food',
  [CrushDateContentType.PLACE]: 'place',
};

function toContentItemResponse(
  item: CrushDateContentItem,
): ContentItemResponse {
  const categoryId = item.contentType === CrushDateContentType.FOOD
    ? foodCategoryIdByLegacy[item.categoryId] ?? item.categoryId
    : item.categoryId === 'other' ? '7' : item.categoryId;

  return {
    id: item.id,
    contentType: responseContentTypes[item.contentType],
    cityCode: item.cityCode as ContentItemResponse['cityCode'],
    categoryId: categoryId as ContentItemResponse['categoryId'],
    name: item.name,
    type: item.type,
    comment: item.comment,
    image: item.image,
    visited: item.visited,
    visitedAt: item.visitedAt?.toISOString() ?? null,
  };
}

async function create(input: CreateContentItemInput): Promise<ContentItemResponse> {
  const item = await prisma.crushDateContentItem.create({
    data: {
      id: `${input.contentType}-${randomUUID()}`,
      contentType: databaseContentTypes[input.contentType],
      cityCode: input.cityCode,
      categoryId: input.categoryId,
      name: input.name,
      type: input.type,
      comment: input.comment,
      image: input.image,
    },
  });

  return toContentItemResponse(item);
}

export async function createWithImage(
  input: CreateContentItemWithImageInput,
): Promise<ContentItemResponse> {
  const uploadedImage = await uploadService.uploadImage({
    contentType: input.contentType,
    buffer: input.buffer,
    mimeType: input.mimeType,
  });

  try {
    if (input.contentType === 'food') {
      return await create({
        contentType: input.contentType,
        cityCode: input.cityCode,
        categoryId: input.categoryId,
        name: input.name,
        type: input.type,
        comment: input.comment,
        image: uploadedImage.url,
      });
    }

    return await create({
      contentType: input.contentType,
      cityCode: input.cityCode,
      categoryId: input.categoryId,
      name: input.name,
      type: input.type,
      comment: input.comment,
      image: uploadedImage.url,
    });
  } catch (error) {
    try {
      await uploadService.deleteImage(uploadedImage.objectKey);
    } catch (cleanupError) {
      console.error('Failed to delete orphaned Crush Date image:', cleanupError);
    }

    throw error;
  }
}

export async function list(
  contentType: ContentType,
  query: ListContentItemsQuery,
): Promise<ContentItemListResponse> {
  let categoryId: Prisma.StringFilter | string | undefined;
  if (contentType === 'food') {
    if (query.categoryId && query.categoryId !== '1') {
      const foodCategoryId = query.categoryId as FoodCategoryId;
      categoryId = {
        in: [foodCategoryId, legacyFoodCategoryById[foodCategoryId]],
      };
    }
  } else if (query.categoryId === '7') {
    categoryId = { in: ['7', 'other'] };
  } else if (query.categoryId && query.categoryId !== '1') {
    categoryId = query.categoryId as PlaceCategoryId;
  }

  const where: Prisma.CrushDateContentItemWhereInput = {
    contentType: databaseContentTypes[contentType],
    cityCode: query.cityCode,
    visited: query.visited,
    categoryId,
    OR: query.keyword
      ? [
        { name: { contains: query.keyword, mode: 'insensitive' } },
        { type: { contains: query.keyword, mode: 'insensitive' } },
        { comment: { contains: query.keyword, mode: 'insensitive' } },
      ]
      : undefined,
  };
  const orderBy: Prisma.CrushDateContentItemOrderByWithRelationInput[] = query.visited
    ? [
      { visitedAt: { sort: 'desc', nulls: 'last' } },
      { id: 'desc' },
    ]
    : [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
  const [items, total] = await prisma.$transaction([
    prisma.crushDateContentItem.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.crushDateContentItem.count({ where }),
  ]);

  return {
    list: items.map(toContentItemResponse),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function getFood(id: string): Promise<ContentItemResponse> {
  const item = await prisma.crushDateContentItem.findFirst({
    where: {
      id,
      contentType: CrushDateContentType.FOOD,
    },
  });
  if (!item) {
    throw new AppError(404, '美食不存在');
  }

  return toContentItemResponse(item);
}

export async function getPlace(id: string): Promise<ContentItemResponse> {
  const item = await prisma.crushDateContentItem.findFirst({
    where: {
      id,
      contentType: CrushDateContentType.PLACE,
    },
  });
  if (!item) {
    throw new AppError(404, '地点不存在');
  }

  return toContentItemResponse(item);
}

export function listCities() {
  return { list: cities };
}

export function listFoodCategories() {
  return { list: foodCategories };
}

export function listPlaceCategories() {
  return { list: placeCategories };
}

export async function remove(id: string): Promise<void> {
  const item = await prisma.crushDateContentItem.findUnique({
    where: { id },
  });
  if (!item) {
    throw new AppError(404, '美食或地点不存在');
  }

  const result = await prisma.crushDateContentItem.deleteMany({
    where: { id },
  });
  if (result.count === 0) {
    throw new AppError(404, '美食或地点不存在');
  }

  try {
    await uploadService.deleteImageByPublicUrl(item.image);
  } catch (error) {
    console.error('Failed to delete Crush Date image after content deletion:', error);
  }
}

export async function updateVisited(
  id: string,
  input: UpdateVisitedInput,
): Promise<ContentItemResponse> {
  const item = await prisma.$transaction(async (transaction) => {
    if (input.visited) {
      await transaction.crushDateContentItem.updateMany({
        where: {
          id,
          visited: false,
        },
        data: {
          visited: true,
          visitedAt: new Date(),
        },
      });
    } else {
      await transaction.crushDateContentItem.updateMany({
        where: {
          id,
          OR: [
            { visited: true },
            { visitedAt: { not: null } },
          ],
        },
        data: {
          visited: false,
          visitedAt: null,
        },
      });
    }

    return transaction.crushDateContentItem.findUnique({
      where: { id },
    });
  });

  if (!item) {
    throw new AppError(404, '美食或地点不存在');
  }

  return toContentItemResponse(item);
}
