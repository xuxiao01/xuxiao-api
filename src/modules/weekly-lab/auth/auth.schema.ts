import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  username: z.string().min(2, '用户名至少 2 个字符').max(30, '用户名最多 30 个字符'),
  password: z.string().min(6, '密码至少 6 位'),
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

export const updateWeeklySettingsSchema = z.object({
  publicWeeklyReportsEnabled: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateWeeklySettingsInput = z.infer<typeof updateWeeklySettingsSchema>;
