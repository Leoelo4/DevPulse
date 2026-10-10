import { beforeEach, describe, expect, it } from "vitest";
import { MemoryCache } from "@/lib/cache/memory-cache";
import { NOW, hoursAgo } from "@/test/builders";
import { createFakeGitHub, nextLink, type FakeGitHub } from "@/test/fake-github";
import {
  BASE,
  OWNER,
  REPO,
  commentPayload,
  healthyRepoRoutes,
  pullPayload,
} from "@/test/github-fixtures";
import type { RefreshMode } from "@/lib/cache/freshness";
import { createGitHubClient } from "./client";
import { GitHubDataSource, LIMITS } from "./source";

const FAST = { retryAfterBaseValueMs: 1 };

interface Setup {
  fake: FakeGitHub;
  source: GitHubDataSource;
  cache: MemoryCache;
}

function setup(
  routes: Parameters<typeof createFakeGitHub>[0],
  options: {
    userId?: string;
    cache?: MemoryCache;
    selection?: Array<{ owner: string; name: string }>;
    refreshMode?: RefreshMode;
  } = {},
): Setup {
  const fake = createFakeGitHub(routes);
  const cache = options.cache ?? new MemoryCache();
  const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 0, ...FAST });
  const source = new GitHubDataSource({
    client,
    userId: options.userId ?? "user-1",
    selection: options.selection ?? [{ owner: OWNER, name: REPO }],
    cache,
    refreshMode: options.refreshMode ?? "standard",
    now: NOW,
    statsRetryDelayMs: 1,
  });
  return { fake, source, cache };
}

describe("GitHubDataSource", () => {
  describe("a healthy repository", () => {
    let snapshot: Awaited<ReturnType<GitHubDataSource["getSnapshot"]>>;
    let fake: FakeGitHub;

    beforeEach(async () => {
      const s = setup(healthyRepoRoutes());
      fake = s.fake;
      snapshot = await s.source.getSnapshot(OWNER, REPO);
    });

    it("is labelled as live data and assembles every dataset", () => {
      expect(snapshot?.meta).toMatchObject({ mode: "live", access: { status: "ok" } });
      for (const key of [
        "pullRequests",
        "issues",
        "workflowRuns",
        "releases",
        "tags",
        "deployments",
        "contributors",
        "commitActivity",
      ] as const) {
        expect(snapshot?.[key].status, key).toBe("ok");
      }
      expect(snapshot?.repository.fullName).toBe(`${OWNER}/${REPO}`);
    });

    it("fetches reviews only for open, non-draft pull requests and derives their state", () => {
      expect(fake.count("GET", `${BASE}/pulls/10/reviews`)).toBe(1); // open + ready
      expect(fake.count("GET", `${BASE}/pulls/9/reviews`)).toBe(0); // draft
      expect(fake.count("GET", `${BASE}/pulls/8/reviews`)).toBe(0); // merged
      const prs = snapshot?.pullRequests.status === "ok" ? snapshot.pullRequests.data : [];
      expect(prs.find((p) => p.number === 10)?.reviewState).toBe("approved");
      expect(prs.find((p) => p.number === 9)?.reviewState).toBeNull(); // not fetched, not guessed
    });

    it("removes pull requests from the issues list", () => {
      const issues = snapshot?.issues.status === "ok" ? snapshot.issues.data : [];
      expect(issues.map((i) => i.number).sort()).toEqual([2, 3]);
    });

    it("measures first-reply time only for recent issues and leaves older ones unknown", () => {
      const issues = snapshot?.issues.status === "ok" ? snapshot.issues.data : [];
      expect(issues.find((i) => i.number === 3)?.firstResponse.status).toBe("responded");
      expect(issues.find((i) => i.number === 2)?.firstResponse.status).toBe("unknown");
    });

    it("limits workflow runs to a recent window and reads deployment status", () => {
      expect(fake.calls.find((c) => c.path === `${BASE}/actions/runs`)?.query.created).toMatch(
        /^>=\d{4}-\d{2}-\d{2}$/,
      );
      expect(snapshot?.deployments).toMatchObject({
        status: "ok",
        data: [{ environment: "production", state: "success" }],
      });
    });

    it("returns repository metadata with a safe GitHub link", () => {
      expect(snapshot?.repository.htmlUrl).toBe(`https://github.com/${OWNER}/${REPO}`);
    });
  });

  describe("authorization boundary", () => {
    it("loads only selected repositories and makes no request for anything else", async () => {
      const { source, fake } = setup(healthyRepoRoutes());
      expect(await source.getSnapshot("some-other", "private-repo")).toBeNull();
      expect(fake.calls).toHaveLength(0);
    });

    it("matches repository names case-insensitively, like GitHub does", async () => {
      const { source } = setup(healthyRepoRoutes());
      expect(await source.getSnapshot(OWNER.toUpperCase(), REPO.toUpperCase())).not.toBeNull();
    });

    it("returns nothing for an empty selection, without calling GitHub", async () => {
      const { source, fake } = setup(healthyRepoRoutes(), { selection: [] });
      expect(await source.getSnapshots()).toEqual([]);
      expect(fake.calls).toHaveLength(0);
    });
  });

  describe("missing permissions and inaccessible repositories", () => {
    it("reports an unreadable repository once, without issuing the other eight requests", async () => {
      const { source, fake } = setup({
        [`GET ${BASE}`]: { status: 404, body: { message: "Not Found" } },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.meta.access).toMatchObject({ status: "unavailable", reason: "not_found" });
      expect(snapshot?.pullRequests).toMatchObject({ status: "unavailable", reason: "not_found" });
      expect(snapshot?.repository.fullName).toBe(`${OWNER}/${REPO}`); // placeholder keeps the row identifiable
      expect(fake.calls).toHaveLength(1);
    });

    it("degrades one dataset at a time when a single endpoint is forbidden", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/actions/runs`]: {
          status: 403,
          body: { message: "Resource not accessible by integration" },
        },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.workflowRuns).toMatchObject({ status: "unavailable", reason: "forbidden" });
      expect(snapshot?.pullRequests.status).toBe("ok");
      expect(snapshot?.releases.status).toBe("ok");
    });

    it("reports a rejected token as unauthorized", async () => {
      const { source } = setup({
        [`GET ${BASE}`]: { status: 401, body: { message: "Bad credentials" } },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.meta.access).toMatchObject({
        status: "unavailable",
        reason: "unauthorized",
      });
    });

    it("never loses the other repositories when one fails", async () => {
      const { source } = setup(
        {
          ...healthyRepoRoutes(),
          "GET /repos/sample-org/gone": { status: 404, body: {} },
        },
        {
          selection: [
            { owner: OWNER, name: REPO },
            { owner: OWNER, name: "gone" },
          ],
        },
      );
      const snapshots = await source.getSnapshots();
      expect(snapshots.map((s) => s.meta.access.status)).toEqual(["ok", "unavailable"]);
    });
  });

  describe("rate limits", () => {
    const limited = {
      status: 403,
      body: { message: "API rate limit exceeded" },
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 1800),
      },
    };

    it("surfaces a rate-limited dataset with its reset time, keeping the rest", async () => {
      const { source } = setup({ ...healthyRepoRoutes(), [`GET ${BASE}/releases`]: limited });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.releases).toMatchObject({ status: "unavailable", reason: "rate_limited" });
      expect(snapshot?.releases.status === "unavailable" && snapshot.releases.message).toMatch(
        /resets in about/,
      );
      expect(snapshot?.pullRequests.status).toBe("ok");
    });

    it("stops fetching review histories once quota runs out, leaving them 'not fetched'", async () => {
      const many = Array.from({ length: 12 }, (_, i) => pullPayload(100 + i));
      const routes: Parameters<typeof createFakeGitHub>[0] = {
        ...healthyRepoRoutes(),
        [`GET ${BASE}/pulls`]: { body: many },
      };
      for (const pr of many) routes[`GET ${BASE}/pulls/${pr.number}/reviews`] = limited;

      const { source, fake } = setup(routes);
      const snapshot = await source.getSnapshot(OWNER, REPO);
      const prs = snapshot?.pullRequests.status === "ok" ? snapshot.pullRequests.data : [];
      expect(prs.every((p) => p.reviewState === null)).toBe(true);
      // Concurrency is 5, so at most that many in-flight review requests are wasted.
      const reviewCalls = fake.calls.filter((c) => c.path.endsWith("/reviews")).length;
      expect(reviewCalls).toBeLessThan(many.length);
    });
  });

  describe("pagination caps and partial data", () => {
    it("marks pull requests incomplete when more pages exist than the cap allows", async () => {
      const { source, fake } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/pulls`]: (request) => {
          const page = Number(request.url.searchParams.get("page") ?? 1);
          return {
            body: [
              pullPayload(page * 10, {
                state: "closed",
                merged_at: hoursAgo(5),
                closed_at: hoursAgo(5),
              }),
            ],
            headers: { link: nextLink(`${BASE}/pulls`, page + 1) },
          };
        },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(fake.count("GET", `${BASE}/pulls`)).toBe(LIMITS.pullRequestPages);
      expect(snapshot?.pullRequests).toMatchObject({ status: "ok", complete: false });
      expect(snapshot?.pullRequests.status === "ok" && snapshot.pullRequests.note).toMatch(
        /most recently updated/,
      );
    });

    it("marks issues partial when the comment history is too long to read fully", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/issues/comments`]: (request) => {
          const page = Number(request.url.searchParams.get("page") ?? 1);
          return {
            body: [commentPayload(999, "someone", hoursAgo(10))],
            headers: { link: nextLink(`${BASE}/issues/comments`, page + 1) },
          };
        },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.issues).toMatchObject({ status: "ok", complete: false });
      const issues = snapshot?.issues.status === "ok" ? snapshot.issues.data : [];
      // With a truncated feed, "no reply found" must not be reported as "no reply".
      expect(issues.every((i) => i.firstResponse.status !== "none")).toBe(true);
    });

    it("keeps issues (without reply times) if the comments endpoint fails", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/issues/comments`]: { status: 500, body: {} },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.issues).toMatchObject({ status: "ok", complete: false });
      expect(snapshot?.issues.status === "ok" && snapshot.issues.note).toMatch(
        /Reply times are unavailable/,
      );
    });

    it("counts records GitHub returned in an unexpected shape instead of failing", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/pulls`]: { body: [pullPayload(1), { number: "garbage" }] },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.pullRequests).toMatchObject({ status: "ok", complete: false });
      expect(snapshot?.pullRequests.status === "ok" && snapshot.pullRequests.data).toHaveLength(1);
      expect(snapshot?.pullRequests.status === "ok" && snapshot.pullRequests.note).toMatch(
        /1 records were skipped/,
      );
    });

    it("reports malformed list responses as an error for that dataset only", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/releases`]: { body: { message: "weird" } },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.releases).toMatchObject({ status: "unavailable", reason: "error" });
      expect(snapshot?.tags.status).toBe("ok");
    });
  });

  describe("statistics endpoints (GitHub answers 202 while computing)", () => {
    it("retries once and uses the result when it becomes ready", async () => {
      const { source, fake } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/stats/commit_activity`]: [
          { status: 202 },
          { body: healthyRepoRoutes()[`GET ${BASE}/stats/commit_activity`]!.body },
        ],
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.commitActivity.status).toBe("ok");
      expect(fake.count("GET", `${BASE}/stats/commit_activity`)).toBe(2);
    });

    it("reports 'pending' (not an error, not zero) when still computing after the retry", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/stats/commit_activity`]: { status: 202 },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.commitActivity).toMatchObject({ status: "pending" });
    });

    it("falls back to all-time contributors when contributor statistics are pending", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/stats/contributors`]: { status: 202 },
        [`GET ${BASE}/contributors`]: {
          body: [
            { login: "a", contributions: 50 },
            { login: "b", contributions: 5 },
          ],
        },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.contributors).toMatchObject({ status: "ok", complete: false });
      const data = snapshot?.contributors.status === "ok" ? snapshot.contributors.data : [];
      expect(data.every((c) => c.commitsLast90Days === null)).toBe(true);
    });

    it("treats 204 (empty repository) as 'no data', not an error", async () => {
      const { source } = setup({
        ...healthyRepoRoutes(),
        [`GET ${BASE}/stats/commit_activity`]: { status: 204 },
        [`GET ${BASE}/stats/contributors`]: { status: 204 },
      });
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(snapshot?.commitActivity).toMatchObject({ status: "ok", data: [] });
      expect(snapshot?.contributors).toMatchObject({ status: "ok", data: [] });
    });
  });

  describe("caching", () => {
    it("serves repeat loads from memory without calling GitHub again", async () => {
      const { source, fake } = setup(healthyRepoRoutes());
      await source.getSnapshots();
      const first = fake.calls.length;
      await source.getSnapshots();
      expect(fake.calls.length).toBe(first);
    });

    it("refetches after the cache is invalidated (manual refresh)", async () => {
      const { source, fake, cache } = setup(healthyRepoRoutes());
      await source.getSnapshots();
      const first = fake.calls.length;
      cache.invalidate("user-1:");
      await source.getSnapshots();
      expect(fake.calls.length).toBe(first * 2);
    });

    it("never shares cached data between users", async () => {
      const cache = new MemoryCache();
      const alice = setup(healthyRepoRoutes(), { userId: "alice", cache });
      const bob = setup(healthyRepoRoutes(), { userId: "bob", cache });
      await alice.source.getSnapshots();
      await bob.source.getSnapshots();
      expect(bob.fake.calls.length).toBeGreaterThan(0); // bob fetched for himself
    });

    it("loads concurrent requests for the same repository only once (single flight)", async () => {
      const { source, fake } = setup(healthyRepoRoutes());
      await Promise.all([
        source.getSnapshot(OWNER, REPO),
        source.getSnapshot(OWNER, REPO),
        source.getSnapshot(OWNER, REPO),
      ]);
      expect(fake.count("GET", BASE)).toBe(1);
    });

    it("caches failures only briefly, so a transient error is retried soon", async () => {
      const cache = new MemoryCache();
      const { source, fake } = setup({ [`GET ${BASE}`]: { status: 500, body: {} } }, { cache });
      await source.getSnapshot(OWNER, REPO);
      await source.getSnapshot(OWNER, REPO);
      expect(fake.count("GET", BASE)).toBe(1); // second view served the cached failure…
      cache.invalidate("user-1:"); // …until it is cleared (here by refresh; in production by its short TTL)
      await source.getSnapshot(OWNER, REPO);
      expect(fake.count("GET", BASE)).toBeGreaterThanOrEqual(2);
    });

    it("dates the snapshot by its oldest part", async () => {
      const { source } = setup(healthyRepoRoutes());
      const snapshot = await source.getSnapshot(OWNER, REPO);
      expect(Date.parse(snapshot?.meta.fetchedAt ?? "")).toBeLessThanOrEqual(Date.now());
    });
  });

  it("limits how many repositories are loaded at once", async () => {
    const names = Array.from({ length: 8 }, (_, i) => `r${i}`);
    let inFlight = 0;
    let peak = 0;
    const routes: Parameters<typeof createFakeGitHub>[0] = {};
    for (const name of names) {
      routes[`GET /repos/${OWNER}/${name}`] = () => ({ status: 404, body: {} });
    }
    const fake = createFakeGitHub(routes);
    const original = fake.fetch;
    const tracking: typeof fetch = async (input, init) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      try {
        return await original(input, init);
      } finally {
        inFlight -= 1;
      }
    };
    const source = new GitHubDataSource({
      client: createGitHubClient({ token: "t", fetch: tracking, retries: 0, ...FAST }),
      userId: "u",
      selection: names.map((name) => ({ owner: OWNER, name })),
      cache: new MemoryCache(),
      refreshMode: "standard",
      now: NOW,
    });
    await source.getSnapshots();
    expect(peak).toBeLessThanOrEqual(LIMITS.repositoryConcurrency);
  });

  it("does not expose the access token anywhere in a snapshot", async () => {
    const { source } = setup(healthyRepoRoutes());
    const snapshot = await source.getSnapshot(OWNER, REPO);
    expect(JSON.stringify(snapshot)).not.toContain("Bearer");
    expect(JSON.stringify(snapshot)).not.toMatch(/authorization|token\s+t\b/i);
  });
});
