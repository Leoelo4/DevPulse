import type { Resource } from "@/lib/domain/types";

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Parses an ISO timestamp to epoch milliseconds. Returns `NaN` for invalid input. */
export function ts(iso: string): number {
  return Date.parse(iso);
}

export function daysBetween(fromIso: string, to: Date): number {
  return (to.getTime() - ts(fromIso)) / MS_PER_DAY;
}

/** Median of a list of numbers, or `null` when the list is empty. */
export function median(values: readonly number[]): number | null {
  return percentile(values, 50);
}

/**
 * Percentile using linear interpolation between closest ranks (the same definition as
 * NumPy's default). `p` is in the range 0–100. Returns `null` for an empty list.
 */
export function percentile(values: readonly number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (rank - lower);
}

/** Returns the ISO date (YYYY-MM-DD) of the Sunday (UTC) that starts the week containing `date`. */
export function weekStartUtc(date: Date): string {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start.toISOString().slice(0, 10);
}

/** The `count` most recent week starts (oldest first), ending with the week containing `now`. */
export function recentWeekStarts(now: Date, count: number): string[] {
  const current = Date.parse(`${weekStartUtc(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(current - (count - 1 - i) * MS_PER_WEEK).toISOString().slice(0, 10),
  );
}

/** The `count` most recent UTC calendar days (oldest first), ending with the day containing `now`. */
export function recentDays(now: Date, count: number): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: count }, (_, i) =>
    new Date(today - (count - 1 - i) * MS_PER_DAY).toISOString().slice(0, 10),
  );
}

export function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Returns the data of an `ok` resource, or `undefined` for pending/unavailable ones. */
export function dataOf<T>(resource: Resource<T>): T | undefined {
  return resource.status === "ok" ? resource.data : undefined;
}

/** Whether a resource is available but a truncated/sampled view of the full dataset. */
export function isPartial<T>(resource: Resource<T>): boolean {
  return resource.status === "ok" && !resource.complete;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
