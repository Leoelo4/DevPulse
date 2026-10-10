import { describe, expect, it } from "vitest";
import { createFakeGitHub, nextLink } from "@/test/fake-github";
import { createGitHubClient } from "./client";
import { fetchPaginated, hasNextPage, type PaginatingClient } from "./paginate";

function fakeClient(pages: Array<{ data: unknown; link?: string }>): PaginatingClient {
  return {
    paginate: {
      async *iterator() {
        for (const page of pages) yield { data: page.data, headers: { link: page.link } };
      },
    },
  };
}

describe("hasNextPage", () => {
  it("detects rel=next in a Link header", () => {
    expect(
      hasNextPage(
        '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"',
      ),
    ).toBe(true);
    expect(hasNextPage('<https://api.github.com/x?page=1>; rel="prev"')).toBe(false);
    expect(hasNextPage(undefined)).toBe(false);
    expect(hasNextPage(5)).toBe(false);
  });
});

describe("fetchPaginated", () => {
  it("collects every page when under the cap", async () => {
    const result = await fetchPaginated(
      fakeClient([{ data: [1, 2], link: 'x; rel="next"' }, { data: [3] }]),
      "GET /x",
      {},
      { maxPages: 5 },
    );
    expect(result).toEqual({ items: [1, 2, 3], complete: true, pagesFetched: 2 });
  });

  it("stops at the page cap and reports the result as incomplete when more pages exist", async () => {
    const link = '<https://api.github.com/x?page=2>; rel="next"';
    const result = await fetchPaginated(
      fakeClient([
        { data: [1], link },
        { data: [2], link },
        { data: [3], link },
      ]),
      "GET /x",
      {},
      { maxPages: 2 },
    );
    expect(result.items).toEqual([1, 2]);
    expect(result.complete).toBe(false);
    expect(result.pagesFetched).toBe(2);
  });

  it("is complete when the cap is reached exactly on the last page", async () => {
    const result = await fetchPaginated(
      fakeClient([{ data: [1], link: '<u>; rel="next"' }, { data: [2] }]),
      "GET /x",
      {},
      { maxPages: 2 },
    );
    expect(result.complete).toBe(true);
  });

  it("handles an empty list", async () => {
    expect(await fetchPaginated(fakeClient([{ data: [] }]), "GET /x", {}, { maxPages: 3 })).toEqual(
      {
        items: [],
        complete: true,
        pagesFetched: 1,
      },
    );
  });

  it("rejects a response that is not a list", async () => {
    await expect(
      fetchPaginated(fakeClient([{ data: { message: "oops" } }]), "GET /x", {}, { maxPages: 1 }),
    ).rejects.toThrow(/list/);
  });

  describe("with the real Octokit client", () => {
    it("follows Link headers across pages", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r/pulls": [
          { body: [{ n: 1 }, { n: 2 }], headers: { link: nextLink("/repos/o/r/pulls", 2) } },
          { body: [{ n: 3 }] },
        ],
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 0 });
      const result = await fetchPaginated(
        client,
        "GET /repos/{owner}/{repo}/pulls",
        { owner: "o", repo: "r" },
        { maxPages: 5 },
      );
      expect(result.items).toHaveLength(3);
      expect(result.complete).toBe(true);
      expect(fake.count("GET", "/repos/o/r/pulls")).toBe(2);
    });

    it("never fetches past the cap, and says the list is incomplete", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r/pulls": (request) => {
          const page = Number(request.url.searchParams.get("page") ?? 1);
          return { body: [{ page }], headers: { link: nextLink("/repos/o/r/pulls", page + 1) } };
        },
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 0 });
      const result = await fetchPaginated(
        client,
        "GET /repos/{owner}/{repo}/pulls",
        { owner: "o", repo: "r" },
        { maxPages: 3 },
      );
      expect(result.pagesFetched).toBe(3);
      expect(result.complete).toBe(false);
      expect(fake.count("GET", "/repos/o/r/pulls")).toBe(3);
    });

    it("normalises endpoints that wrap the list (e.g. workflow_runs)", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r/actions/runs": {
          body: { total_count: 2, workflow_runs: [{ id: 1 }, { id: 2 }] },
        },
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 0 });
      const result = await fetchPaginated(
        client,
        "GET /repos/{owner}/{repo}/actions/runs",
        { owner: "o", repo: "r" },
        { maxPages: 2 },
      );
      expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("surfaces API failures from any page as errors", async () => {
      const fake = createFakeGitHub({
        "GET /repos/o/r/pulls": [
          { body: [{ n: 1 }], headers: { link: nextLink("/repos/o/r/pulls", 2) } },
          { status: 500, body: { message: "boom" } },
        ],
      });
      const client = createGitHubClient({ token: "t", fetch: fake.fetch, retries: 0 });
      await expect(
        fetchPaginated(
          client,
          "GET /repos/{owner}/{repo}/pulls",
          { owner: "o", repo: "r" },
          { maxPages: 5 },
        ),
      ).rejects.toMatchObject({ status: 500 });
    });
  });
});
