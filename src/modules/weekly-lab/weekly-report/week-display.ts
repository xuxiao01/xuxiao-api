import { parseWeekNumber } from './week-key';

function formatDateDot(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function formatShortDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}.${d}`;
}

export function buildWeekDisplayFields(weekKey: string, startDate: Date, endDate: Date) {
  const weekNumber = parseWeekNumber(weekKey);
  const weekLabel = weekNumber > 0 ? `第 ${weekNumber} 周` : weekKey;

  return {
    weekLabel,
    dateRange: `${formatDateDot(startDate)} - ${formatDateDot(endDate)}`,
    shortDateRange: `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`,
  };
}
