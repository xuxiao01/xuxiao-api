const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const activePlanDateLookbackDays = 14;

function getShanghaiDateParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function isValidPlanDate(value: string): boolean {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getShanghaiDate(date = new Date()): string {
  const values = getShanghaiDateParts(date);
  return `${values.year}-${values.month}-${values.day}`;
}

export function getEarliestActivePlanDate(date = new Date()): string {
  const values = getShanghaiDateParts(date);
  const earliestDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) - activePlanDateLookbackDays,
  ));
  return earliestDate.toISOString().slice(0, 10);
}

export function isActivePlanDateAllowed(value: string, date = new Date()): boolean {
  return isValidPlanDate(value) && value >= getEarliestActivePlanDate(date);
}
