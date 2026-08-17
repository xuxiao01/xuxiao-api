import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../utils/app-error';
import {
  createContentItemSchema,
  contentItemParamsSchema,
  listFoodsQuerySchema,
  listPlacesQuerySchema,
  updateLocationSchema,
  updateVisitedSchema,
} from './content-item.schema';
import * as contentItemService from './content-item.service';

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

export async function listFoods(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listFoodsQuerySchema.parse(req.query);
    const result = await contentItemService.list('food', query);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listPlaces(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listPlacesQuerySchema.parse(req.query);
    const result = await contentItemService.list('place', query);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getFood(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contentItemParamsSchema.parse(req.params);
    const item = await contentItemService.getFood(id);
    return res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function getPlace(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = contentItemParamsSchema.parse(req.params);
    const item = await contentItemService.getPlace(id);
    return res.json(item);
  } catch (error) {
    next(error);
  }
}

export function listCities(_req: Request, res: Response) {
  return res.json(contentItemService.listCities());
}

export function listFoodCategories(_req: Request, res: Response) {
  return res.json(contentItemService.listFoodCategories());
}

export function listPlaceCategories(_req: Request, res: Response) {
  return res.json(contentItemService.listPlaceCategories());
}

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

export async function updateLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = contentItemParamsSchema.parse(req.params);
    const input = updateLocationSchema.parse(req.body);
    const item = await contentItemService.updateLocation(id, input);
    return res.json(item);
  } catch (error) {
    next(error);
  }
}
