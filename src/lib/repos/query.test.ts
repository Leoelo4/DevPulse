import { describe, expect, it } from "vitest";
import { buildRepoHref, parseRepoQuery, queryRepositories, repoQuerySchema } from "./query";
import type { RepositoryRow } from "./rows";

const row = (overrides: Partial<RepositoryRow> = {}): RepositoryRow => ({
  owner: "sample-org",
  name: "repo",
  fullName: "sample-org/repo",
  description: null,
  language: "TypeScript",
  stars: 0,
  forks: 0,
  isPrivate: false,
  isArchived: false,
  openPullRequests: 0,
  openIssues: 0,
  ciStatus: "passing",
  healthLevel: "healthy",
  lastActivityAt: "2026-06-01T00:00:00Z",
  htmlUrl: null,
  access: { ok: true },
  ...overrides,
});

const DEFAULTS = repoQuerySchema.parse({});

const rows = [
  row({
    name: "alpha",
    fullName: "sample-org/alpha",
    stars: 5,
    language: "Go",
    description: "Fast CLI",
    lastActivityAt: "2026-06-03T00:00:00Z",
    healthLevel: "healthy",
    ciStatus: "passing",
    openPullRequests: 3,
  }),
  row({
    name: "bravo",
    fullName: "sample-org/bravo",
    stars: 50,
    language: "TypeScript",
    description: "Web client",
    lastActivityAt: "2026-06-01T00:00:00Z",
    healthLevel: "at_risk",
    ciStatus: "failing",
    openPullRequests: null,
  }),
  row({
    name: "charlie",
    fullName: "sample-org/charlie",
    stars: 20,
    language: "Python",
    description: "Data pipeline",
    lastActivityAt: "2026-06-02T00:00:00Z",
    healthLevel: "needs_attention",
    ciStatus: "unknown",
    openPullRequests: 1,
  }),
];

describe("parseRepoQuery", () => {
  it("applies defaults for an empty query string", () => {
    expect(parseRepoQuery({})).toEqual({
      q: "",
      language: "all",
      health: "all",
      ci: "all",
      sort: "updated",
      dir: "desc",
      page: 1,
      size: 10,
    });
  });

  it("falls back to defaults on hostile or malformed values instead of throwing", () => {
    const parsed = parseRepoQuery({
      sort: "drop table",
      dir: "sideways",
      page: "-4",
      size: "9999",
      health: "<script>",
      ci: ["failing", "passing"],
      q: "x".repeat(500),
    });
    expect(parsed).toMatchObject({
      sort: "updated",
      dir: "desc",
      page: 1,
      size: 10,
      health: "all",
      ci: "failing",
      q: "",
    });
  });

  it("accepts valid values and trims the search text", () => {
    expect(
      parseRepoQuery({
        q: "  cli ",
        sort: "stars",
        dir: "asc",
        page: "3",
        size: "5",
        health: "at_risk",
      }),
    ).toMatchObject({
      q: "cli",
      sort: "stars",
      dir: "asc",
      page: 3,
      size: 5,
      health: "at_risk",
    });
  });
});

describe("queryRepositories", () => {
  it("searches name, description and language case-insensitively", () => {
    expect(queryRepositories(rows, { ...DEFAULTS, q: "WEB" }).rows.map((r) => r.name)).toEqual([
      "bravo",
    ]);
    expect(queryRepositories(rows, { ...DEFAULTS, q: "python" }).rows.map((r) => r.name)).toEqual([
      "charlie",
    ]);
    expect(queryRepositories(rows, { ...DEFAULTS, q: "nomatch" }).total).toBe(0);
  });

  it("filters by language, health and CI status, and combines filters", () => {
    expect(
      queryRepositories(rows, { ...DEFAULTS, language: "Go" }).rows.map((r) => r.name),
    ).toEqual(["alpha"]);
    expect(
      queryRepositories(rows, { ...DEFAULTS, health: "at_risk" }).rows.map((r) => r.name),
    ).toEqual(["bravo"]);
    expect(queryRepositories(rows, { ...DEFAULTS, ci: "unknown" }).rows.map((r) => r.name)).toEqual(
      ["charlie"],
    );
    expect(queryRepositories(rows, { ...DEFAULTS, language: "Go", ci: "failing" }).total).toBe(0);
  });

  it("sorts in both directions", () => {
    const names = (sort: RepoQueryResultSort, dir: "asc" | "desc") =>
      queryRepositories(rows, { ...DEFAULTS, sort, dir }).rows.map((r) => r.name);
    expect(names("stars", "desc")).toEqual(["bravo", "charlie", "alpha"]);
    expect(names("stars", "asc")).toEqual(["alpha", "charlie", "bravo"]);
    expect(names("name", "asc")).toEqual(["alpha", "bravo", "charlie"]);
    expect(names("updated", "desc")).toEqual(["alpha", "charlie", "bravo"]);
    expect(names("health", "asc")).toEqual(["bravo", "charlie", "alpha"]); // riskiest first
  });

  it("sorts unknown (null) counts last regardless of direction semantics", () => {
    const asc = queryRepositories(rows, { ...DEFAULTS, sort: "prs", dir: "asc" }).rows.map(
      (r) => r.name,
    );
    expect(asc).toEqual(["charlie", "alpha", "bravo"]);
  });

  it("breaks ties by name so ordering is stable", () => {
    const tied = [row({ name: "b", fullName: "o/b" }), row({ name: "a", fullName: "o/a" })];
    expect(queryRepositories(tied, { ...DEFAULTS, sort: "stars" }).rows.map((r) => r.name)).toEqual(
      ["a", "b"],
    );
  });

  describe("pagination", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      row({ name: `r${String(i).padStart(2, "0")}`, fullName: `o/r${String(i).padStart(2, "0")}` }),
    );

    it("slices into pages and reports counts", () => {
      const page1 = queryRepositories(many, {
        ...DEFAULTS,
        sort: "name",
        dir: "asc",
        size: 5,
        page: 1,
      });
      expect(page1.rows.map((r) => r.name)).toEqual(["r00", "r01", "r02", "r03", "r04"]);
      expect(page1).toMatchObject({ total: 12, pageCount: 3, page: 1 });
      const page3 = queryRepositories(many, {
        ...DEFAULTS,
        sort: "name",
        dir: "asc",
        size: 5,
        page: 3,
      });
      expect(page3.rows.map((r) => r.name)).toEqual(["r10", "r11"]);
    });

    it("clamps an out-of-range page to the last page", () => {
      expect(queryRepositories(many, { ...DEFAULTS, size: 5, page: 99 }).page).toBe(3);
    });
  });

  it("handles an empty repository list", () => {
    const result = queryRepositories([], DEFAULTS);
    expect(result).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      languages: [],
      hasActiveFilters: false,
    });
  });

  it("reports the available languages and whether any filter is active", () => {
    const result = queryRepositories(rows, { ...DEFAULTS, q: "x" });
    expect(result.languages).toEqual(["Go", "Python", "TypeScript"]);
    expect(result.hasActiveFilters).toBe(true);
    expect(queryRepositories(rows, DEFAULTS).hasActiveFilters).toBe(false);
  });
});

type RepoQueryResultSort = Parameters<typeof queryRepositories>[1]["sort"];

describe("buildRepoHref", () => {
  it("omits default values and applies patches", () => {
    expect(buildRepoHref(DEFAULTS, {})).toBe("?");
    expect(buildRepoHref(DEFAULTS, { sort: "stars", dir: "asc" })).toBe("?sort=stars&dir=asc");
    expect(buildRepoHref({ ...DEFAULTS, q: "cli", page: 4 }, { page: 1 })).toBe("?q=cli");
  });

  it("round-trips through the parser", () => {
    const query = {
      ...DEFAULTS,
      q: "a b&c",
      language: "C++",
      health: "at_risk" as const,
      sort: "forks" as const,
      page: 2,
      size: 5 as const,
    };
    const href = buildRepoHref(query, {});
    const params = Object.fromEntries(new URLSearchParams(href.slice(1)));
    expect(parseRepoQuery(params)).toEqual(query);
  });
});
