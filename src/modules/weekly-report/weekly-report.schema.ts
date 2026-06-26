import { z } from 'zod';

export const reportItemSchema = z.object({
  title: z.string().min(1, '条目标题不能为空'),
  description: z.string().default(''),
  images: z.array(z.string().url('图片必须是合法 URL')).default([]),
});

export const putReportSchema = z.object({
  partLabel: z.string().min(1, 'partLabel 不能为空'),
  title: z.string().min(1, 'title 不能为空'),
  completed: z.array(reportItemSchema).default([]),
  nextPlans: z.array(reportItemSchema).default([]),
});

export const putWeeklyReportSchema = z
  .object({
    startDate: z.string().date('startDate 格式不正确').optional(),
    endDate: z.string().date('endDate 格式不正确').optional(),
    isPublished: z.boolean().optional(),
    reports: z.array(putReportSchema),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate === undefined || data.endDate === undefined) {
        return true;
      }
      return data.startDate <= data.endDate;
    },
    { message: 'startDate 不能晚于 endDate' },
  );

export type PutWeeklyReportBody = z.infer<typeof putWeeklyReportSchema>;
