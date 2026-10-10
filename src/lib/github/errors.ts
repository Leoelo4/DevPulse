import type { Resource, UnavailableReason } from "@/lib/domain/types";

/**
 * A GitHub API failure translated into something the UI can explain. Raw Octokit errors never
 * reach pages: their messages can include request details, and their shape is an implementation
 * detail of the HTTP client.
 */
export class GitHubApiError extends Error {
  override readonly name = "GitHubApiError";

  constructor(
    readonly kind: UnavailableReason,
    message: string,
    readonly status?: number,
    /** When rate limited: the instant GitHub says the quota resets. */
    readonly resetAt?: Date,
  ) {
    super(message);
  }
}

/** Thrown when a GitHub response is structurally not what the endpoint documents. */
export class UnexpectedResponseError extends Error {
  override readonly name = "UnexpectedResponseError";
}

/** The subset of an Octokit `RequestError` this module reads. */
interface RequestErrorLike {
  status?: unknown;
  response?: { headers?: Record<string, string | number | undefined>; data?: unknown };
  message?: unknown;
}

function header(error: RequestErrorLike, name: string): string | undefined {
  const value = error.response?.headers?.[name];
  return value === undefined ? undefined : String(value);
}

function resetFromHeaders(error: RequestErrorLike, now: number): Date | undefined {
  const reset = Number(header(error, "x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return new Date(reset * 1000);
  const retryAfter = Number(header(error, "retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return new Date(now + retryAfter * 1000);
  return undefined;
}

function looksRateLimited(error: RequestErrorLike): boolean {
  if (header(error, "x-ratelimit-remaining") === "0") return true;
  const text = [error.message, JSON.stringify(error.response?.data ?? "")].join(" ").toLowerCase();
  return text.includes("rate limit") || text.includes("abuse detection");
}

function formatReset(resetAt: Date | undefined, now: number): string {
  if (!resetAt) return "Try again in a few minutes.";
  const minutes = Math.max(1, Math.ceil((resetAt.getTime() - now) / 60_000));
  return `It resets in about ${minutes} minute${minutes === 1 ? "" : "s"} (${resetAt.toISOString().slice(11, 16)} UTC).`;
}

/**
 * Maps any thrown value to a `GitHubApiError`. Unknown errors become a generic "error" with a safe
 * message so internals are never shown to the viewer.
 */
export function toGitHubError(error: unknown, now: number = Date.now()): GitHubApiError {
  if (error instanceof GitHubApiError) return error;

  if (error instanceof UnexpectedResponseError) {
    return new GitHubApiError(
      "error",
      "GitHub returned data in an unexpected format. This is usually temporary; if it persists, please report it.",
    );
  }

  const candidate = (typeof error === "object" && error !== null ? error : {}) as RequestErrorLike;
  const status = typeof candidate.status === "number" ? candidate.status : undefined;

  if (status === 401) {
    return new GitHubApiError(
      "unauthorized",
      "GitHub rejected the access token. It may have expired or been revoked — sign in again to reconnect.",
      status,
    );
  }

  if (status === 429 || (status === 403 && looksRateLimited(candidate))) {
    const resetAt = resetFromHeaders(candidate, now);
    return new GitHubApiError(
      "rate_limited",
      `GitHub's API rate limit was reached. ${formatReset(resetAt, now)} Cached data is still shown where available.`,
      status,
      resetAt,
    );
  }

  if (status === 403 || status === 451) {
    return new GitHubApiError(
      "forbidden",
      "GitHub did not allow this request. The authorization DevPulse holds may not cover this repository or data — for private repositories, enable private access in Settings, and check that your organization has approved DevPulse.",
      status,
    );
  }

  if (status === 404) {
    return new GitHubApiError(
      "not_found",
      "GitHub reports this does not exist, or it is not visible with the current authorization (GitHub answers 404 for private repositories you cannot access).",
      status,
    );
  }

  if (status !== undefined && status >= 500) {
    return new GitHubApiError(
      "error",
      "GitHub returned a server error. Try again shortly.",
      status,
    );
  }

  if (status !== undefined) {
    return new GitHubApiError("error", `GitHub rejected the request (HTTP ${status}).`, status);
  }

  return new GitHubApiError(
    "error",
    "DevPulse could not reach GitHub. Check your connection and try again.",
  );
}

export function unavailable(
  error: unknown,
  now?: number,
): Extract<Resource<never>, { status: "unavailable" }> {
  const mapped = toGitHubError(error, now);
  return { status: "unavailable", reason: mapped.kind, message: mapped.message };
}

/**
 * Whether a throttled request should be retried. Waiting inside a page render is only acceptable
 * for a few seconds; anything longer is reported to the viewer instead.
 */
export function shouldRetryRateLimit(
  retryAfterSeconds: number,
  retryCount: number,
  maxWaitSeconds = 5,
): boolean {
  return retryCount < 1 && retryAfterSeconds <= maxWaitSeconds;
}
