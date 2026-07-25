import { randomUUID } from 'node:crypto';
import {
  CrushDatePlanStatus,
  Prisma,
  type CrushDatePlanPhoto,
} from '../../../generated/client';
import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/app-error';
import * as uploadService from '../upload/upload.service';
import type {
  CreatePlanPhotoInput,
  PlanPhotoListResponse,
  PlanPhotoResponse,
  ReorderPlanPhotosInput,
} from './plan-photo.types';

const MAX_PLAN_PHOTOS = 9;

function toPlanPhotoResponse(photo: CrushDatePlanPhoto): PlanPhotoResponse {
  return {
    id: photo.id,
    url: uploadService.buildPublicUrl(photo.objectKey),
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt.toISOString(),
  };
}

async function assertCompletedPlan(planId: string): Promise<void> {
  const plan = await prisma.crushDatePlan.findUnique({
    where: { id: planId },
    select: { status: true },
  });
  if (!plan) {
    throw new AppError(404, '计划不存在');
  }
  if (plan.status !== CrushDatePlanStatus.COMPLETED) {
    throw new AppError(409, '只有过去的计划可以管理照片');
  }
}

async function lockPlan(
  transaction: Prisma.TransactionClient,
  planId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "crush_date_plans" WHERE "id" = ${planId} FOR UPDATE`,
  );
}

async function assertCompletedPlanInTransaction(
  transaction: Prisma.TransactionClient,
  planId: string,
): Promise<void> {
  const plan = await transaction.crushDatePlan.findUnique({
    where: { id: planId },
    select: { status: true },
  });
  if (!plan) {
    throw new AppError(404, '计划不存在');
  }
  if (plan.status !== CrushDatePlanStatus.COMPLETED) {
    throw new AppError(409, '只有过去的计划可以管理照片');
  }
}

export async function create(
  planId: string,
  input: CreatePlanPhotoInput,
): Promise<PlanPhotoResponse> {
  const plan = await prisma.crushDatePlan.findUnique({
    where: { id: planId },
    select: {
      status: true,
      _count: { select: { photos: true } },
    },
  });
  if (!plan) {
    throw new AppError(404, '计划不存在');
  }
  if (plan.status !== CrushDatePlanStatus.COMPLETED) {
    throw new AppError(409, '只有过去的计划可以上传照片');
  }
  if (plan._count.photos >= MAX_PLAN_PHOTOS) {
    throw new AppError(409, '每个计划最多上传 9 张照片');
  }

  const photoId = `photo-${randomUUID()}`;
  const uploadedImage = await uploadService.uploadImageAtPath({
    objectKeyWithoutExtension: `crush-date/plan-photos/${planId}/${photoId}`,
    buffer: input.buffer,
    mimeType: input.mimeType,
  });

  try {
    const photo = await prisma.$transaction(async (transaction) => {
      await lockPlan(transaction, planId);
      await assertCompletedPlanInTransaction(transaction, planId);

      const count = await transaction.crushDatePlanPhoto.count({
        where: { planId },
      });
      if (count >= MAX_PLAN_PHOTOS) {
        throw new AppError(409, '每个计划最多上传 9 张照片');
      }

      const aggregate = await transaction.crushDatePlanPhoto.aggregate({
        where: { planId },
        _max: { sortOrder: true },
      });

      return transaction.crushDatePlanPhoto.create({
        data: {
          id: photoId,
          planId,
          objectKey: uploadedImage.objectKey,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
        },
      });
    });

    return toPlanPhotoResponse(photo);
  } catch (error) {
    try {
      await uploadService.deleteImage(uploadedImage.objectKey);
    } catch (cleanupError) {
      console.error('Failed to delete orphaned plan photo:', cleanupError);
    }
    throw error;
  }
}

export async function list(planId: string): Promise<PlanPhotoListResponse> {
  await assertCompletedPlan(planId);
  const photos = await prisma.crushDatePlanPhoto.findMany({
    where: { planId },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return {
    list: photos.map(toPlanPhotoResponse),
  };
}

export async function reorder(
  planId: string,
  input: ReorderPlanPhotosInput,
): Promise<PlanPhotoListResponse> {
  const photos = await prisma.$transaction(async (transaction) => {
    await lockPlan(transaction, planId);
    await assertCompletedPlanInTransaction(transaction, planId);

    const existingPhotos = await transaction.crushDatePlanPhoto.findMany({
      where: { planId },
      select: { id: true },
    });
    const existingIds = new Set(existingPhotos.map((photo) => photo.id));
    if (
      existingIds.size !== input.photoIds.length
      || input.photoIds.some((photoId) => !existingIds.has(photoId))
    ) {
      throw new AppError(400, 'photoIds 必须完整包含当前计划的全部照片');
    }

    await Promise.all(input.photoIds.map((photoId, sortOrder) => (
      transaction.crushDatePlanPhoto.updateMany({
        where: { id: photoId, planId },
        data: { sortOrder },
      })
    )));

    return transaction.crushDatePlanPhoto.findMany({
      where: { planId },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
  });

  return {
    list: photos.map(toPlanPhotoResponse),
  };
}

export async function remove(planId: string, photoId: string): Promise<void> {
  const objectKey = await prisma.$transaction(async (transaction) => {
    await lockPlan(transaction, planId);
    await assertCompletedPlanInTransaction(transaction, planId);

    const photo = await transaction.crushDatePlanPhoto.findFirst({
      where: { id: photoId, planId },
      select: { objectKey: true },
    });
    if (!photo) {
      throw new AppError(404, '照片不存在');
    }

    await transaction.crushDatePlanPhoto.delete({
      where: { id: photoId },
    });

    const remainingPhotos = await transaction.crushDatePlanPhoto.findMany({
      where: { planId },
      select: { id: true },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });
    await Promise.all(remainingPhotos.map((remainingPhoto, sortOrder) => (
      transaction.crushDatePlanPhoto.updateMany({
        where: { id: remainingPhoto.id, planId },
        data: { sortOrder },
      })
    )));

    return photo.objectKey;
  });

  try {
    await uploadService.deleteImage(objectKey);
  } catch (error) {
    console.error(`Failed to delete plan photo ${objectKey}:`, error);
  }
}
