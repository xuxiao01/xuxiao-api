import type { MianjingCompany, MianjingOccurrence, MianjingQuestion } from '../../generated/client';
import { AppError } from '../../utils/app-error';

export const categoryValues = {
  八股: 'FUNDAMENTALS',
  手撕: 'CODING',
  算法: 'ALGORITHM',
  场景题: 'SCENARIO',
} as const;
export const priorityValues = { 高: 'HIGH', 中: 'MEDIUM', 低: 'LOW' } as const;
export const masteryValues = {
  不会: 'UNKNOWN',
  模糊: 'FUZZY',
  基本掌握: 'BASIC',
  熟练: 'PROFICIENT',
} as const;
export const recruitmentValues = {
  日常: 'DAILY',
  暑期: 'SUMMER',
  秋招: 'AUTUMN',
} as const;
export const roundValues = {
  一面: 'FIRST',
  二面: 'SECOND',
  三面: 'THIRD',
} as const;

function label<T extends string>(values: Record<string, T>, code: T): string {
  return Object.keys(values).find((key) => values[key] === code)!;
}

export function safeCount(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AppError(409, '出现次数超出安全整数范围');
  }
  return Number(value);
}

export function companyDto(company: MianjingCompany) {
  return { ...company };
}

export function questionDto(
  question: MianjingQuestion,
  recordCount: bigint,
  companies: Map<string, MianjingCompany>,
) {
  return {
    id: question.id,
    title: question.title,
    category: label(categoryValues, question.category),
    tags: question.tags,
    companyIds: question.companyIds,
    companies: question.companyIds
      .map((id) => companies.get(id))
      .filter((item): item is MianjingCompany => !!item)
      .map(companyDto),
    priority: label(priorityValues, question.priority),
    mastery: label(masteryValues, question.mastery),
    organized: question.organized,
    baseCount: safeCount(question.baseCount),
    recordCount: safeCount(recordCount),
    totalCount: safeCount(question.baseCount + recordCount),
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  };
}

export function occurrenceDto(occurrence: MianjingOccurrence & { company: MianjingCompany }) {
  return {
    id: occurrence.id,
    questionId: occurrence.questionId,
    companyId: occurrence.companyId,
    company: companyDto(occurrence.company),
    content: occurrence.content,
    createdAt: occurrence.createdAt.toISOString(),
    recruitmentType:
      occurrence.recruitmentType === null
        ? null
        : label(recruitmentValues, occurrence.recruitmentType),
    round: occurrence.round === null ? null : label(roundValues, occurrence.round),
  };
}
