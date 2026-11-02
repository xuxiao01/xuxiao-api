import { z } from 'zod';

export const mianjingConfigSchema = z.object({
  MIANJING_GUEST_JWT_SECRET: z.string().optional(),
  MIANJING_ADMIN_USER_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().max(2147483647).optional(),
  ),
});

// Missing configuration means read-only; it never grants the first visitor admin access.
export const mianjingConfig = mianjingConfigSchema.parse(process.env);

export function isMianjingAdmin(userId: number): boolean {
  return mianjingConfig.MIANJING_ADMIN_USER_ID === userId;
}
