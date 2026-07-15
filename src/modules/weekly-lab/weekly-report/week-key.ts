const WEEK_KEY_REGEX = /^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/;

export function isValidWeekKey(weekKey: string): boolean {
  return WEEK_KEY_REGEX.test(weekKey);
}

export function assertValidWeekKey(weekKey: string): void {
  if (!isValidWeekKey(weekKey)) {
    throw new Error('week_key 格式非法');
  }
}

export function parseWeekNumber(weekKey: string): number {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return 0;
  }
  return Number.parseInt(match[2], 10);
}
