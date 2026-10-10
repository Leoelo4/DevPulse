import { Octokit } from "octokit";
import { createConditionalFetch, withTimeout, type EtagCache } from "./conditional-fetch";
import { shouldRetryRateLimit } from "./errors";

export type GitHubClient = InstanceType<typeof Octokit>;

export interface GitHubClientOptions {
  /** The viewer's OAuth access token. Server-side only: never pass this to a client component. */
  token: string;
  /** Per-user ETag cache; enables free conditional requests. */
  etagCache?: EtagCache;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Longest rate-limit wait (seconds) worth blocking a page render for. Longer waits are reported. */
  maxRateLimitWaitSeconds?: number;
  /** Retries for transient 5xx errors. */
  retries?: number;
  requestTimeoutMs?: number;
  /**
   * Milliseconds per "retry-after unit" for both the throttling and retry plugins (their defaults
   * are 1000 and 400). Only tests should set this, to run real retry paths without real waits.
   */
  retryAfterBaseValueMs?: number;
}

const API_VERSION = "2022-11-28";

/**
 * Creates the Octokit client used for all live data. Behaviour that matters here:
 *
 * - Rate limits: Octokit's bundled throttling serialises requests and honours GitHub's retry hints,
 *   but its defaults will wait however long GitHub asks. A page render cannot wait minutes, so the
 *   handlers only retry when the wait is a few seconds; otherwise the error surfaces and the UI
 *   explains when the quota resets.
 * - Retries: transient 5xx responses are retried a small, fixed number of times.
 * - Timeouts: every request is aborted after `requestTimeoutMs`.
 * - Revalidation: GETs go through the ETag cache when one is supplied.
 */
export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  const maxWait = options.maxRateLimitWaitSeconds ?? 5;
  let fetchImpl = options.fetch ?? globalThis.fetch;

  const withVersion =
    (base: typeof fetchImpl): typeof fetchImpl =>
    (input, init) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("x-github-api-version")) headers.set("x-github-api-version", API_VERSION);
      return base(input, { ...init, headers });
    };

  fetchImpl = withTimeout(fetchImpl, options.requestTimeoutMs ?? 15_000);
  if (options.etagCache) fetchImpl = createConditionalFetch(fetchImpl, options.etagCache);
  fetchImpl = withVersion(fetchImpl);

  return new Octokit({
    auth: options.token,
    userAgent: "DevPulse",
    request: { fetch: fetchImpl },
    throttle: {
      // The plugin ignores the return type, but at runtime `true` means "wait and retry".
      onRateLimit: (retryAfter: number, _request: unknown, _octokit: unknown, retryCount: number) =>
        shouldRetryRateLimit(retryAfter, retryCount, maxWait),
      onSecondaryRateLimit: (
        retryAfter: number,
        _request: unknown,
        _octokit: unknown,
        retryCount: number,
      ) => shouldRetryRateLimit(retryAfter, retryCount, maxWait),
      ...(options.retryAfterBaseValueMs !== undefined
        ? { retryAfterBaseValue: options.retryAfterBaseValueMs }
        : {}),
    },
    retry: {
      retries: options.retries ?? 2,
      ...(options.retryAfterBaseValueMs !== undefined
        ? { retryAfterBaseValue: options.retryAfterBaseValueMs }
        : {}),
    },
  });
}
