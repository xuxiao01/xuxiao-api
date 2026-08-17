import type { NextFunction, Request, Response } from 'express';
import { poiSuggestionsQuerySchema } from './map.schema';
import * as mapService from './map.service';

export async function listPoiSuggestions(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = poiSuggestionsQuerySchema.parse(req.query);
    const result = await mapService.listPoiSuggestions(query);
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
