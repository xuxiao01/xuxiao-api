import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../utils/app-error';
import {
  planPhotoItemParamsSchema,
  planPhotoParamsSchema,
  reorderPlanPhotosSchema,
} from './plan-photo.schema';
import * as planPhotoService from './plan-photo.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId } = planPhotoParamsSchema.parse(req.params);
    if (!req.file) {
      throw new AppError(400, 'file 图片文件必填');
    }

    const photo = await planPhotoService.create(planId, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    return res.status(201).json(photo);
  } catch (error) {
    next(error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId } = planPhotoParamsSchema.parse(req.params);
    const photos = await planPhotoService.list(planId);
    return res.json(photos);
  } catch (error) {
    next(error);
  }
}

export async function reorder(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId } = planPhotoParamsSchema.parse(req.params);
    const input = reorderPlanPhotosSchema.parse(req.body);
    const photos = await planPhotoService.reorder(planId, input);
    return res.json(photos);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { planId, photoId } = planPhotoItemParamsSchema.parse(req.params);
    await planPhotoService.remove(planId, photoId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
