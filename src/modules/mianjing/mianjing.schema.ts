import { z } from 'zod';

export const categories = ['八股', '手撕', '算法', '场景题'] as const;
export const priorities = ['高', '中', '低'] as const;
export const masteries = ['不会', '模糊', '基本掌握', '熟练'] as const;
export const recruitmentTypes = ['日常', '暑期', '秋招'] as const;
export const rounds = ['一面', '二面', '三面'] as const;
export const palettes = [
  'teal',
  'orange',
  'yellow',
  'red',
  'coral',
  'blue',
  'purple',
  'gray',
  'white',
  'black',
] as const;

export const idSchema = z.uuid('ID 格式无效').transform((value) => value.toLowerCase());
const companyIds = z
  .array(idSchema)
  .max(500)
  .transform((ids) => [...new Set(ids)]);
const tags = z
  .array(z.string().trim().min(1).max(100))
  .max(100)
  .transform((values) => [...new Set(values)]);
const content = z
  .string()
  .max(200000, '内容最多 200000 字符')
  .transform((value) => value.trim());
const questionFields = z
  .object({
    title: z.string().trim().min(1, '请填写题目').max(10000),
    category: z.enum(categories),
    tags,
    priority: z.enum(priorities),
    mastery: z.enum(masteries),
    organized: z.boolean(),
  })
  .strict();

export const createQuestionSchema = questionFields
  .extend({
    tags: tags.default([]),
    priority: z.enum(priorities).default('中'),
    mastery: z.enum(masteries).default('模糊'),
    organized: z.boolean().default(false),
    source: z
      .object({
        companyId: idSchema,
        recruitmentType: z.enum(recruitmentTypes),
        round: z.enum(rounds),
      })
      .strict()
      .optional(),
  })
  .strict();

export const updateQuestionSchema = questionFields
  .partial()
  .refine((input) => Object.keys(input).length > 0, '至少提交一个修改字段');

export const updateMetaSchema = z
  .object({
    companyIds: companyIds.optional(),
    mastery: z.enum(masteries).optional(),
    organized: z.boolean().optional(),
    totalCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, '至少提交一个修改字段');

export const createOccurrenceSchema = z
  .object({
    companyId: idSchema,
    content: content.refine((value) => value.length > 0, '请填写这次问的内容'),
  })
  .strict();

export const updateOccurrenceSchema = z.object({ content }).strict();

const companySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    palette: z.enum(palettes),
    enabled: z.boolean(),
  })
  .strict();

export const saveCatalogSchema = z
  .object({
    items: z.array(companySchema).max(500),
  })
  .strict()
  .superRefine(({ items }, context) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      context.addIssue({ code: 'custom', message: '公司 ID 不能重复' });
    }
    if (new Set(items.map((item) => item.name)).size !== items.length) {
      context.addIssue({ code: 'custom', message: '公司名称不能重复' });
    }
  });

const optionalString = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : value),
    schema.optional(),
  );
export const listQuerySchema = z
  .object({
    search: z
      .string()
      .max(1000)
      .transform((value) => value.trim())
      .default(''),
    category: optionalString(z.enum(categories)),
    company: optionalString(idSchema),
    mastery: optionalString(z.enum(masteries)),
    organized: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(['priority', 'count', 'updated']).default('priority'),
    page: z.coerce.number().int().min(1).max(2147483647).default(1),
    pageSize: z.enum(['10', '20', '50']).default('20').transform(Number),
  })
  .strict();

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type UpdateMetaInput = z.infer<typeof updateMetaSchema>;
export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>;
export type CatalogInput = z.infer<typeof saveCatalogSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
