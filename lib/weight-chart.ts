export const weightRanges = [
  { label: "All time", months: 0 },
  { label: "1 year", months: 12 },
  { label: "6 months", months: 6 },
  { label: "3 months", months: 3 },
  { label: "1 month", months: 1 },
] as const;

export function rangeStart(today: string, months: number): string | null {
  if (!months) return null;
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}
