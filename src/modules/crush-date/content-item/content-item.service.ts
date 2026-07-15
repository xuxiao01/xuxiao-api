import { randomUUID } from 'node:crypto';
import {
  CrushDateContentType,
  type CrushDateContentItem,
} from '../../../generated/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/app-error';
import * as uploadService from '../upload/upload.service';
import type {
  ContentItemListResponse,
  ContentItemResponse,
  ContentType,
  CreateContentItemInput,
  CreateContentItemWithImageInput,
  ListContentItemsQuery,
  UpdateVisitedInput,
} from './content-item.types';

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
  return {
    id: item.id,
    contentType: responseContentTypes[item.contentType],
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
    return await create({
      contentType: input.contentType,
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
  const where = {
    contentType: databaseContentTypes[contentType],
  };
  const [items, total] = await prisma.$transaction([
    prisma.crushDateContentItem.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.crushDateContentItem.count({ where }),
  ]);

  return {
    list: items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      comment: item.comment,
      image: item.image,
      visited: item.visited,
      visitedAt: item.visitedAt?.toISOString() ?? null,
    })),
    total,
  };
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
