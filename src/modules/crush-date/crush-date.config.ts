import { z } from 'zod';

const crushDateConfigSchema = z.object({
  OSS_REGION: z.string().min(1),
  OSS_BUCKET: z.string().min(1),
  OSS_ENDPOINT: z.string().url(),
  OSS_PUBLIC_BASE_URL: z.string().url(),
  OSS_ACCESS_KEY_ID: z.string().min(1),
  OSS_ACCESS_KEY_SECRET: z.string().min(1),
  TENCENT_MAP_WEB_SERVICE_KEY: z.string().default(''),
  TENCENT_MAP_API_BASE_URL: z.string().url().default('https://apis.map.qq.com'),
  TENCENT_MAP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  TENCENT_MAP_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  TENCENT_MAP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  TENCENT_MAP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
});

const parsed = crushDateConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid Crush Date environment variables:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const crushDateConfig = parsed.data;
