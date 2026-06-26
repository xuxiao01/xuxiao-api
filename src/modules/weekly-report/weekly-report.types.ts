export interface ReportListItemDto {
  title: string;
  description: string;
  images: string[];
}

export interface WeeklyReportDto {
  id: number;
  weekLabel: string;
  dateRange: string;
  shortDateRange: string;
  partLabel: string;
  title: string;
  completed: ReportListItemDto[];
  nextPlans: ReportListItemDto[];
}

export interface WeeklyReportWeekResponse {
  id: string;
  weekLabel: string;
  dateRange: string;
  shortDateRange: string;
  reports: WeeklyReportDto[];
  isPublished?: boolean;
}

export interface WeeklyReportWeekListItem {
  id: string;
  weekLabel: string;
  dateRange: string;
  shortDateRange: string;
  reportCount: number;
  isPublished: boolean;
  updatedAt: string;
}

export interface PutReportInput {
  partLabel: string;
  title: string;
  completed: ReportListItemDto[];
  nextPlans: ReportListItemDto[];
}

export interface PutWeeklyReportInput {
  startDate?: string;
  endDate?: string;
  isPublished?: boolean;
  reports: PutReportInput[];
}
