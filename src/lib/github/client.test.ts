import { describe, expect, it } from "vitest";
import { createFakeGitHub } from "@/test/fake-github";
import { EtagCache } from "./conditional-fetch";
import { createGitHubClient } from "./client";
import { toGitHubError } from "./errors";

const FAST = { retryAfterBaseValueMs: 1 };
const resetIn = (seconds: number) => String(Math.floor(Date.now() / 1000) + seconds);

describe("createGitHubClient", () => {
  it("authenticates with the token, identifies itself and pins the API version", async () => {
    const fake = createFakeGitHub({ "GET /user": { body: { login: "x" } } });
    const client = createGitHubClient({ token: "secret-token", fetch: fake.fetch, ...FAST });
    await client.request("GET /user");
    const call = fake.calls[0];
    expect(call?.headers.get("authorization")).toBe("token secret-token");
    expect(call?.headers.get("x-github-api-version")).toBe("2022-11-28");
    expect(call?.headers.get("user-agent")).toContain("DevPulse");
  });

  describe("rate limits", () => {
    it("does not wait out a long rate limit: it fails fast with the reset time", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r": {
          status: 403,
          body: { message: "API rate limit exceeded" },
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": resetIn(20 * 60) },
        },
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, ...FAST });

      const started = Date.now();
      const error = await client
        .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
        .catch((e: unknown) => e);
      expect(Date.now() - started).toBeLessThan(2000); // did not sleep for 20 minutes
      expect(fake.calls).toHaveLength(1); // and did not retry

      const mapped = toGitHubError(error);
      expect(mapped.kind).toBe("rate_limited");
      expect(mapped.resetAt!.getTime()).toBeGreaterThan(Date.now() + 15 * 60_000);
      expect(mapped.message).toMatch(/resets in about 2\d minutes|resets in about 1\d minutes/);
    });

    it("retries once when the wait is short, and then succeeds", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r": [
          {
            status: 403,
            body: { message: "API rate limit exceeded" },
            headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": resetIn(1) },
          },
          { body: { id: 1 } },
        ],
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, ...FAST });
      const response = await client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
      expect(response.status).toBe(200);
      expect(fake.calls).toHaveLength(2);
    });

    it("does not retry forever: a second rate-limit response is surfaced", async () => {
      const limited = {
        status: 403,
        body: { message: "API rate limit exceeded" },
        headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": resetIn(1) },
      };
      const fake = createFakeGitHub({ "GET /repos/o/r": [limited, limited, limited] });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, ...FAST });
      const error = await client
        .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
        .catch((e: unknown) => e);
      expect(toGitHubError(error).kind).toBe("rate_limited");
      expect(fake.calls.length).toBeLessThanOrEqual(2);
    });

    it("reports a secondary rate limit (retry-after) as rate limited", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r": {
          status: 403,
          body: { message: "You have exceeded a secondary rate limit." },
          headers: { "retry-after": "120" },
        },
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, ...FAST });
      const error = await client
        .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
        .catch((e: unknown) => e);
      expect(toGitHubError(error).kind).toBe("rate_limited");
      expect(fake.calls).toHaveLength(1);
    });
  });

  describe("transient failures", () => {
    it("retries a 5xx and returns the eventual success", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r": [{ status: 502, body: { message: "Bad gateway" } }, { body: { id: 7 } }],
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 2, ...FAST });
      const response = await client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
      expect(response.data).toMatchObject({ id: 7 });
      expect(fake.calls).toHaveLength(2);
    });

    it("gives up after the configured retries", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r": { status: 503, body: { message: "down" } },
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 1, ...FAST });
      const error = await client
        .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
        .catch((e: unknown) => e);
      expect(toGitHubError(error)).toMatchObject({ kind: "error", status: 503 });
      expect(fake.calls).toHaveLength(2); // original + one retry
    });

    it("does not retry client errors", async () => {
      const fake = createFakeGitHub({});
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 3, ...FAST });
      const error = await client
        .request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" })
        .catch((e: unknown) => e);
      expect(toGitHubError(error).kind).toBe("not_found");
      expect(fake.calls).toHaveLength(1);
    });

    it("maps a rejected token to unauthorized", async () => {
      const fake = createFakeGitHub({
        "GET /user": { status: 401, body: { message: "Bad credentials" } },
      });
      const client = createGitHubClient({ token: "revoked", fetch: fake.fetch, ...FAST });
      const error = await client.request("GET /user").catch((e: unknown) => e);
      expect(toGitHubError(error).kind).toBe("unauthorized");
    });
  });

  it("revalidates with ETags when a cache is supplied, so repeat reads are conditional", async () => {
    const fake = createFakeGitHub({
      "GET /repos/o/r": (request) =>
        request.headers.get("if-none-match") === '"abc"'
          ? { status: 304 }
          : { body: { id: 1 }, headers: { etag: '"abc"' } },
    });
    const client = createGitHubClient({
      token: "t",
      fetch: fake.fetch,
      etagCache: new EtagCache(),
      ...FAST,
    });
    const first = await client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
    const second = await client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
    expect(second.data).toEqual(first.data);
    expect(fake.calls[1]?.headers.get("if-none-match")).toBe('"abc"');
  });
});
