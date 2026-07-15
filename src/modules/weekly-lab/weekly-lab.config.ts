import { z } from 'zod';

const weeklyLabConfigSchema = z.object({
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parsed = weeklyLabConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid Weekly Lab environment variables:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const weeklyLabConfig = parsed.data;
