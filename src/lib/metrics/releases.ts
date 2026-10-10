import type { Release } from "@/lib/domain/types";
import { daysBetween, median, MS_PER_DAY, ts } from "./util";

export interface ReleaseSummary {
  /** Published, non-draft releases in the dataset (newest first). */
  published: Release[];
  latest: Release | null;
  /** Calculated: whole days since the latest published release, or `null` when there is none. */
  daysSinceLatest: number | null;
  /** Calculated: median gap between consecutive published releases (needs at least 2). */
  medianDaysBetween: number | null;
}

export function summarizeReleases(releases: readonly Release[], now: Date): ReleaseSummary {
  const published = releases
    .filter((release) => !release.draft && release.publishedAt !== null)
    .sort((a, b) => ts(b.publishedAt as string) - ts(a.publishedAt as string));

  const latest = published[0] ?? null;
  const gaps: number[] = [];
  for (let i = 0; i < published.length - 1; i += 1) {
    const newer = published[i] as Release;
    const older = published[i + 1] as Release;
    gaps.push((ts(newer.publishedAt as string) - ts(older.publishedAt as string)) / MS_PER_DAY);
  }

  return {
    published,
    latest,
    daysSinceLatest: latest ? Math.floor(daysBetween(latest.publishedAt as string, now)) : null,
    medianDaysBetween: median(gaps),
  };
}
