import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../utils/app-error';
import {
  createContentItemSchema,
  contentItemParamsSchema,
  listContentItemsQuerySchema,
  updateVisitedSchema,
} from './content-item.schema';
import * as contentItemService from './content-item.service';
import type { ContentType } from './content-item.types';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError(400, 'file 图片文件必填');
    }

    const input = createContentItemSchema.parse(req.body);
    const item = await contentItemService.createWithImage({
      ...input,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    return res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

function createListHandler(contentType: ContentType) {
  return async function list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listContentItemsQuerySchema.parse(req.query);
      const result = await contentItemService.list(contentType, query);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const listFoods = createListHandler('food');
export const listPlaces = createListHandler('place');

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contentItemParamsSchema.parse(req.params);
    await contentItemService.remove(id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateVisited(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = contentItemParamsSchema.parse(req.params);
    const input = updateVisitedSchema.parse(req.body);
    const item = await contentItemService.updateVisited(id, input);
    return res.json(item);
  } catch (error) {
    next(error);
  }
}
