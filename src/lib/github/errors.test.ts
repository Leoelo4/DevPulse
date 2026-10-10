import { describe, expect, it } from "vitest";
import {
  GitHubApiError,
  shouldRetryRateLimit,
  toGitHubError,
  UnexpectedResponseError,
  unavailable,
} from "./errors";

const NOW = Date.parse("2026-06-17T12:00:00Z");
const httpError = (
  status: number,
  headers: Record<string, string> = {},
  data: unknown = {},
  message = "boom",
) => ({ status, message, response: { headers, data } });

describe("toGitHubError", () => {
  it("maps 401 to unauthorized with reconnect guidance", () => {
    const error = toGitHubError(httpError(401), NOW);
    expect(error.kind).toBe("unauthorized");
    expect(error.message).toMatch(/sign in again/i);
  });

  it("maps 404 to not_found and explains GitHub's private-repository behaviour", () => {
    const error = toGitHubError(httpError(404), NOW);
    expect(error.kind).toBe("not_found");
    expect(error.message).toMatch(/private/i);
  });

  it("maps a plain 403 to forbidden and points at private access / org approval", () => {
    const error = toGitHubError(httpError(403, {}, { message: "Resource not accessible" }), NOW);
    expect(error.kind).toBe("forbidden");
    expect(error.message).toMatch(/private access/i);
  });

  describe("rate limiting", () => {
    it("recognises a primary rate limit by the remaining-quota header and reports the reset time", () => {
      const reset = Math.floor(NOW / 1000) + 12 * 60;
      const error = toGitHubError(
        httpError(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) }),
        NOW,
      );
      expect(error.kind).toBe("rate_limited");
      expect(error.resetAt?.getTime()).toBe(reset * 1000);
      expect(error.message).toMatch(/12 minutes/);
      expect(error.message).toMatch(/12:12 UTC/);
    });

    it("recognises secondary/abuse limits by message and uses retry-after", () => {
      const error = toGitHubError(
        httpError(
          403,
          { "retry-after": "60" },
          { message: "You have exceeded a secondary rate limit." },
        ),
        NOW,
      );
      expect(error.kind).toBe("rate_limited");
      expect(error.resetAt?.getTime()).toBe(NOW + 60_000);
    });

    it("maps 429 to rate_limited", () => {
      expect(toGitHubError(httpError(429), NOW).kind).toBe("rate_limited");
    });

    it("does not call a limit with remaining quota a rate limit", () => {
      const error = toGitHubError(httpError(403, { "x-ratelimit-remaining": "4000" }), NOW);
      expect(error.kind).toBe("forbidden");
    });

    it("falls back to generic wording when no reset time is known", () => {
      expect(toGitHubError(httpError(429), NOW).message).toMatch(/try again in a few minutes/i);
    });
  });

  it("maps 5xx to a generic server error", () => {
    const error = toGitHubError(httpError(502), NOW);
    expect(error.kind).toBe("error");
    expect(error.status).toBe(502);
  });

  it("maps other 4xx to error with the status", () => {
    expect(toGitHubError(httpError(422), NOW).message).toContain("422");
  });

  it("maps network failures (no status) to a safe 'could not reach GitHub' error", () => {
    const error = toGitHubError(new TypeError("fetch failed: ECONNREFUSED 10.0.0.5:443"), NOW);
    expect(error.kind).toBe("error");
    expect(error.message).toMatch(/could not reach GitHub/);
    // Internal details (hosts, ports, stack) never reach the viewer.
    expect(error.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it("maps unexpected response shapes to an honest message", () => {
    const error = toGitHubError(new UnexpectedResponseError("bad shape"), NOW);
    expect(error.kind).toBe("error");
    expect(error.message).toMatch(/unexpected format/);
  });

  it("passes GitHubApiError instances through unchanged", () => {
    const original = new GitHubApiError("forbidden", "nope", 403);
    expect(toGitHubError(original)).toBe(original);
  });

  it("copes with null, strings and garbage", () => {
    for (const value of [null, undefined, "oops", 42, {}]) {
      expect(toGitHubError(value, NOW).kind).toBe("error");
    }
  });
});

describe("unavailable", () => {
  it("builds an unavailable Resource from any error", () => {
    expect(unavailable(httpError(404), NOW)).toMatchObject({
      status: "unavailable",
      reason: "not_found",
    });
  });
});

describe("shouldRetryRateLimit", () => {
  it("retries once, and only when the wait is short", () => {
    expect(shouldRetryRateLimit(2, 0)).toBe(true);
    expect(shouldRetryRateLimit(5, 0)).toBe(true);
    expect(shouldRetryRateLimit(6, 0)).toBe(false); // too long to block a page render
    expect(shouldRetryRateLimit(2, 1)).toBe(false); // already retried
    expect(shouldRetryRateLimit(20, 0, 30)).toBe(true); // configurable ceiling
  });
});
