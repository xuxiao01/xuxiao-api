import { z } from 'zod';

const optional = z.preprocess((value) => value === '' ? undefined : value, z.string().optional());

export const prChangeLogConfigSchema = z.object({
  PR_CHANGE_LOG_ADMIN_USER_ID: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.coerce.number().int().positive().max(2147483647).optional(),
  ),
  PR_CHANGE_LOG_INGEST_TOKEN: optional,
  PR_CHANGE_LOG_REPOSITORIES: z.string().default(''),
  PR_CHANGE_LOG_AI_API_BASE: optional,
  PR_CHANGE_LOG_AI_API_KEY: optional,
  PR_CHANGE_LOG_AI_MODEL: optional,
});

export type PrChangeLogConfig = z.infer<typeof prChangeLogConfigSchema>;
export const prChangeLogConfig = prChangeLogConfigSchema.parse(process.env);

export function allowedRepositories(config: PrChangeLogConfig): string[] {
  return config.PR_CHANGE_LOG_REPOSITORIES.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}
