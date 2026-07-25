import { z } from 'zod';

export const planPhotoParamsSchema = z.object({
  planId: z.string().trim().min(1, 'planId 不能为空'),
});

export const planPhotoItemParamsSchema = z.object({
  planId: z.string().trim().min(1, 'planId 不能为空'),
  photoId: z.string().trim().min(1, 'photoId 不能为空'),
});

export const reorderPlanPhotosSchema = z
  .object({
    photoIds: z
      .array(z.string().trim().min(1, 'photoId 不能为空'))
      .max(9, '照片数量不能超过 9 张'),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.photoIds).size !== input.photoIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['photoIds'],
        message: 'photoIds 不能重复',
      });
    }
  });
