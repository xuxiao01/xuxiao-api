import { z } from 'zod';
import { contentTypes } from './content-item.types';

export const createContentItemSchema = z
  .object({
    contentType: z.enum(contentTypes),
    name: z.string().trim().min(1, 'name 不能为空'),
    type: z.string().trim().min(1, 'type 不能为空'),
    comment: z.string().trim(),
  })
  .strict();

export const listContentItemsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
