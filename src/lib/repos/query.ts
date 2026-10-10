import { z } from "zod";
import type { RepositoryRow } from "./rows";

export const PAGE_SIZES = [5, 10, 25] as const;

const SORT_KEYS = ["name", "stars", "forks", "updated", "prs", "issues", "health"] as const;
const HEALTH_FILTERS = [
  "all",
  "healthy",
  "needs_attention",
  "at_risk",
  "insufficient_data",
] as const;
const CI_FILTERS = ["all", "passing", "failing", "running", "no_runs", "unknown"] as const;

/**
 * Query-string schema for the explorer. URLs are untrusted input, so every field uses `.catch` to
 * fall back to its default instead of rejecting — a hand-edited URL degrades, it never errors.
 */
export const repoQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  language: z.string().max(60).catch("all"),
  health: z.enum(HEALTH_FILTERS).catch("all"),
  ci: z.enum(CI_FILTERS).catch("all"),
  sort: z.enum(SORT_KEYS).catch("updated"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  size: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(5), z.literal(10), z.literal(25)]))
    .catch(10),
});

export type RepoQuery = z.infer<typeof repoQuerySchema>;
export type RepoSortKey = (typeof SORT_KEYS)[number];

type RawParams = Record<string, string | string[] | undefined>;

/** Parses Next's `searchParams` (arrays collapse to their first value). */
export function parseRepoQuery(raw: RawParams): RepoQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return repoQuerySchema.parse({
    q: first(raw.q),
    language: first(raw.language),
    health: first(raw.health),
    ci: first(raw.ci),
    sort: first(raw.sort),
    dir: first(raw.dir),
    page: first(raw.page),
    size: first(raw.size),
  });
}

const HEALTH_RANK = { at_risk: 0, needs_attention: 1, insufficient_data: 2, healthy: 3 } as const;

function compare(a: RepositoryRow, b: RepositoryRow, sort: RepoSortKey): number {
  const nullsLast = (x: number | null, y: number | null) =>
    x === null && y === null ? 0 : x === null ? 1 : y === null ? -1 : x - y;

  switch (sort) {
    case "name":
      return a.fullName.localeCompare(b.fullName);
    case "stars":
      return a.stars - b.stars;
    case "forks":
      return a.forks - b.forks;
    case "updated":
      return Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt);
    case "prs":
      return nullsLast(a.openPullRequests, b.openPullRequests);
    case "issues":
      return nullsLast(a.openIssues, b.openIssues);
    case "health":
      return HEALTH_RANK[a.healthLevel] - HEALTH_RANK[b.healthLevel];
  }
}

export interface RepoQueryResult {
  rows: RepositoryRow[];
  /** Rows matching the filters, before pagination. */
  total: number;
  page: number;
  pageCount: number;
  languages: string[];
  hasActiveFilters: boolean;
}

export function queryRepositories(
  all: readonly RepositoryRow[],
  query: RepoQuery,
): RepoQueryResult {
  const needle = query.q.toLowerCase();

  const matches = all.filter((row) => {
    if (needle) {
      const haystack =
        `${row.fullName} ${row.description ?? ""} ${row.language ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (query.language !== "all" && row.language !== query.language) return false;
    if (query.health !== "all" && row.healthLevel !== query.health) return false;
    if (query.ci !== "all" && row.ciStatus !== query.ci) return false;
    return true;
  });

  const direction = query.dir === "asc" ? 1 : -1;
  const sorted = [...matches].sort(
    // Name is the stable tiebreaker so equal values never reshuffle between renders.
    (a, b) => compare(a, b, query.sort) * direction || a.fullName.localeCompare(b.fullName),
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / query.size));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.size;

  const languages = [
    ...new Set(all.map((row) => row.language).filter((l): l is string => l !== null)),
  ].sort();

  return {
    rows: sorted.slice(start, start + query.size),
    total: sorted.length,
    page,
    pageCount,
    languages,
    hasActiveFilters:
      query.q !== "" || query.language !== "all" || query.health !== "all" || query.ci !== "all",
  };
}

/** Builds a `?…` string from the current query with `patch` applied, omitting default values. */
export function buildRepoHref(query: RepoQuery, patch: Partial<RepoQuery>): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.language !== "all") params.set("language", next.language);
  if (next.health !== "all") params.set("health", next.health);
  if (next.ci !== "all") params.set("ci", next.ci);
  if (next.sort !== "updated") params.set("sort", next.sort);
  if (next.dir !== "desc") params.set("dir", next.dir);
  if (next.page !== 1) params.set("page", String(next.page));
  if (next.size !== 10) params.set("size", String(next.size));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}
