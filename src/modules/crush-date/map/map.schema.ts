import { z } from 'zod';
import { cityCodes } from '../content-item/content-item.config';

export const poiSuggestionsQuerySchema = z.object({
  cityCode: z.enum(cityCodes),
  keyword: z.string()
    .trim()
    .min(2, 'keyword 至少需要 2 个字符')
    .max(50, 'keyword 不能超过 50 个字符'),
}).strict();
