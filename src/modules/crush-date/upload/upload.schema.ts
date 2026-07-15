import { z } from 'zod';
import { contentTypes } from '../content-item/content-item.types';

export const uploadImageFieldsSchema = z.object({
  contentType: z.enum(contentTypes),
});
