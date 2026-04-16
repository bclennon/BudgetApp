/**
 * Returns the ISO date string "YYYY-MM-DD" for the given year, month (1-indexed), and
 * desired dayOfMonth. If dayOfMonth exceeds the last day of that month the excess days
 * overflow into the following month, matching the original Android app's behaviour.
 *
 * Examples:
 *   resolveDueDate(2023, 2, 31) → "2023-03-03"  (Feb only has 28 days in 2023)
 *   resolveDueDate(2024, 2, 31) → "2024-03-02"  (Feb has 29 days in leap year 2024)
 *   resolveDueDate(2024, 4, 31) → "2024-05-01"  (April only has 30 days)
 */
export function resolveDueDate(year: number, month: number, dayOfMonth: number): string {
  // new Date(year, month, 0).getDate() gives the last day of month `month` (1-indexed)
  const lastDay = new Date(year, month, 0).getDate();
  if (dayOfMonth <= lastDay) {
    return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  }
  const overflow = dayOfMonth - lastDay;
  const date = new Date(Date.UTC(year, month - 1, lastDay));
  date.setUTCDate(date.getUTCDate() + overflow);
  return date.toISOString().slice(0, 10);
}
