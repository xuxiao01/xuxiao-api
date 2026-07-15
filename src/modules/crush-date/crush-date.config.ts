import { z } from 'zod';

const crushDateConfigSchema = z.object({
  OSS_REGION: z.string().min(1),
  OSS_BUCKET: z.string().min(1),
  OSS_ENDPOINT: z.string().url(),
  OSS_PUBLIC_BASE_URL: z.string().url(),
  OSS_ACCESS_KEY_ID: z.string().min(1),
  OSS_ACCESS_KEY_SECRET: z.string().min(1),
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
