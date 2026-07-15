import type {
  WeeklyReport,
  WeeklyReportItem,
  WeeklyReportWeek,
} from '../../../generated/client';
import { buildWeekDisplayFields } from './week-display';
import type {
  ReportListItemDto,
  WeeklyReportDto,
  WeeklyReportWeekListItem,
  WeeklyReportWeekResponse,
} from './weekly-report.types';

type WeekWithReports = WeeklyReportWeek & {
  reports: (WeeklyReport & {
    items: WeeklyReportItem[];
  })[];
};

function toItemDto(item: WeeklyReportItem): ReportListItemDto {
  const images = Array.isArray(item.images)
    ? (item.images as string[])
    : [];

  return {
    title: item.title,
    description: item.description,
    images,
  };
}

function toReportDto(
  report: WeeklyReport & { items: WeeklyReportItem[] },
  display: ReturnType<typeof buildWeekDisplayFields>,
): WeeklyReportDto {
  const completed = report.items
    .filter((item) => item.section === 'completed')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toItemDto);

  const nextPlans = report.items
    .filter((item) => item.section === 'next_plans')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toItemDto);

  return {
    id: report.id,
    weekLabel: display.weekLabel,
    dateRange: display.dateRange,
    shortDateRange: display.shortDateRange,
    partLabel: report.partLabel,
    title: report.title,
    completed,
    nextPlans,
  };
}

export function toWeekResponse(week: WeekWithReports): WeeklyReportWeekResponse {
  const display = buildWeekDisplayFields(week.weekKey, week.startDate, week.endDate);

  return {
    id: week.weekKey,
    weekLabel: display.weekLabel,
    dateRange: display.dateRange,
    shortDateRange: display.shortDateRange,
    isPublished: week.isPublished,
    reports: week.reports
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((report) => toReportDto(report, display)),
  };
}

export function toWeekListItem(week: WeekWithReports): WeeklyReportWeekListItem {
  const display = buildWeekDisplayFields(week.weekKey, week.startDate, week.endDate);

  return {
    id: week.weekKey,
    weekLabel: display.weekLabel,
    dateRange: display.dateRange,
    shortDateRange: display.shortDateRange,
    reportCount: week.reports.length,
    isPublished: week.isPublished,
    updatedAt: week.updatedAt.toISOString(),
  };
}

export const weekInclude = {
  reports: {
    include: {
      items: true,
    },
  },
} as const;
