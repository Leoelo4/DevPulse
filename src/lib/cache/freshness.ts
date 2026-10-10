import type { Resource } from "@/lib/domain/types";

/**
 * Explicit freshness rules: how long each kind of GitHub data is served from memory before DevPulse
 * asks GitHub again. Chosen so that slow-moving data (releases, statistics) is fetched rarely and
 * fast-moving data (CI runs) stays current, while a single dashboard load stays well inside the
 * authenticated rate limit of 5,000 requests/hour.
 *
 * Even after a TTL expires, requests are conditional (ETag), so unchanged data costs no quota.
 */
export type CachedResourceKind =
  | "repository"
  | "pullRequests"
  | "reviews"
  | "issues"
  | "issueComments"
  | "workflowRuns"
  | "releases"
  | "tags"
  | "deployments"
  | "commitActivity"
  | "contributors"
  | "repositoryList";

const MINUTE = 60_000;

/** Base TTLs in the "standard" refresh mode. */
export const BASE_TTL_MS: Record<CachedResourceKind, number> = {
  repository: 15 * MINUTE,
  pullRequests: 5 * MINUTE,
  reviews: 5 * MINUTE,
  issues: 5 * MINUTE,
  issueComments: 5 * MINUTE,
  workflowRuns: 2 * MINUTE,
  releases: 15 * MINUTE,
  tags: 30 * MINUTE,
  deployments: 10 * MINUTE,
  commitActivity: 60 * MINUTE,
  contributors: 60 * MINUTE,
  repositoryList: 10 * MINUTE,
};

export const REFRESH_MODES = ["fresh", "standard", "conservative"] as const;
export type RefreshMode = (typeof REFRESH_MODES)[number];

export const REFRESH_MODE_MULTIPLIER: Record<RefreshMode, number> = {
  /** Check GitHub more often; uses more of the rate limit. */
  fresh: 0.25,
  standard: 1,
  /** Serve from memory longer; best for large repository sets or shared tokens. */
  conservative: 4,
};

export const REFRESH_MODE_LABEL: Record<RefreshMode, { title: string; description: string }> = {
  fresh: {
    title: "Fresh",
    description: "Re-check GitHub about four times as often. Uses more of your hourly rate limit.",
  },
  standard: {
    title: "Standard",
    description:
      "Balanced: CI runs every 2 minutes, pull requests and issues every 5, releases every 15.",
  },
  conservative: {
    title: "Conservative",
    description: "Keep data four times longer. Fewest requests; data may lag behind GitHub.",
  },
};

/** Failures and pending statistics are retried soon, but not on every page view. */
export const NEGATIVE_TTL_MS = 60_000;

export function ttlFor(kind: CachedResourceKind, mode: RefreshMode): number {
  return Math.round(BASE_TTL_MS[kind] * REFRESH_MODE_MULTIPLIER[mode]);
}

/** TTL for a loaded value: successes use the freshness table, anything else the short negative TTL. */
export function ttlForResource(
  kind: CachedResourceKind,
  mode: RefreshMode,
  value: Resource<unknown>,
): number {
  return value.status === "ok" ? ttlFor(kind, mode) : NEGATIVE_TTL_MS;
}

export function isRefreshMode(value: unknown): value is RefreshMode {
  return typeof value === "string" && (REFRESH_MODES as readonly string[]).includes(value);
}
