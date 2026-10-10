import { describe, expect, it } from "vitest";
import { MemoryCache } from "@/lib/cache/memory-cache";
import {
  MemorySelectionStore,
  PrismaSelectionStore,
  type SelectionPrisma,
} from "@/lib/db/selection-store";
import { createGitHubClient } from "@/lib/github/client";
import { createFakeGitHub } from "@/test/fake-github";
import { repoPayload } from "@/test/github-fixtures";
import { hasPrivateAccess, listAccessibleRepositories } from "./accessible-repos";
import { readRateLimit } from "./rate-limit";
import { revokeGitHubToken } from "./revoke-token";
import { saveSelection } from "./selection-service";

const client = (routes: Parameters<typeof createFakeGitHub>[0]) => {
  const fake = createFakeGitHub(routes);
  return {
    fake,
    client: createGitHubClient({
      token: "user-token",
      fetch: fake.fetch,
      retries: 0,
      retryAfterBaseValueMs: 1,
    }),
  };
};

const repo = (owner: string, name: string, extra: Record<string, unknown> = {}) =>
  repoPayload({ name, full_name: `${owner}/${name}`, owner: { login: owner }, ...extra });

describe("saveSelection", () => {
  const setup = (routes: Parameters<typeof createFakeGitHub>[0]) => {
    const { fake, client: c } = client(routes);
    const store = new MemorySelectionStore();
    const cache = new MemoryCache();
    return { fake, store, cache, deps: { userId: "user-1", client: c, store, cache } };
  };

  it("verifies access to every repository, then saves GitHub's canonical spelling and clears the cache", async () => {
    const { deps, store, cache } = setup({
      "GET /repos/octo/hello": { body: repo("Octo", "Hello") },
    });
    await cache.getOrLoad("user-1:old:thing", 1e6, async () => "stale");
    await cache.getOrLoad("user-2:other", 1e6, async () => "keep");

    const result = await saveSelection(deps, ["octo/hello"]);

    expect(result).toMatchObject({ ok: true, count: 1 });
    expect(await store.list("user-1")).toEqual([{ owner: "Octo", name: "Hello" }]);
    expect(cache.size).toBe(1); // user-1's entries were cleared, user-2's were not
  });

  it("refuses a repository the user's token cannot read (forged field naming someone else's private repo)", async () => {
    const { deps, store } = setup({
      "GET /repos/octo/mine": { body: repo("octo", "mine") },
      // GitHub answers 404 for private repositories you cannot access.
      "GET /repos/victim/secret": { status: 404, body: { message: "Not Found" } },
    });
    const result = await saveSelection(deps, ["octo/mine", "victim/secret"]);
    expect(result).toMatchObject({ ok: false, inaccessible: ["victim/secret"] });
    expect(await store.list("user-1")).toEqual([]); // nothing partially saved
  });

  it("refuses repositories the token is forbidden from reading", async () => {
    const { deps } = setup({
      "GET /repos/org/locked": { status: 403, body: { message: "SAML enforcement" } },
    });
    expect(await saveSelection(deps, ["org/locked"])).toMatchObject({
      ok: false,
      inaccessible: ["org/locked"],
    });
  });

  it("does not save when access could not be verified (e.g. rate limited)", async () => {
    const { deps, store } = setup({
      "GET /repos/octo/hello": {
        status: 403,
        body: { message: "API rate limit exceeded" },
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        },
      },
    });
    const result = await saveSelection(deps, ["octo/hello"]);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/Could not verify/);
    expect(await store.list("user-1")).toEqual([]);
  });

  it("rejects invalid input before making any GitHub request", async () => {
    const { deps, fake } = setup({});
    for (const input of [[], ["../etc/passwd"], ["a/b/c"], "octo/hello", null, [42]]) {
      expect(await saveSelection(deps, input)).toMatchObject({ ok: false });
    }
    expect(fake.calls).toHaveLength(0);
  });

  it("enforces the cap on tracked repositories", async () => {
    const { deps, fake } = setup({});
    const tooMany = Array.from({ length: 13 }, (_, i) => `o/r${i}`);
    expect(await saveSelection(deps, tooMany)).toMatchObject({ ok: false });
    expect(fake.calls).toHaveLength(0);
  });

  it("only ever writes to the authenticated user's own selection", async () => {
    const { deps, store } = setup({ "GET /repos/octo/hello": { body: repo("octo", "hello") } });
    await saveSelection(deps, ["octo/hello"]);
    expect(await store.list("someone-else")).toEqual([]);
  });

  it("replaces the previous selection rather than appending", async () => {
    const { deps, store } = setup({
      "GET /repos/octo/a": { body: repo("octo", "a") },
      "GET /repos/octo/b": { body: repo("octo", "b") },
    });
    await saveSelection(deps, ["octo/a"]);
    await saveSelection(deps, ["octo/b"]);
    expect(await store.list("user-1")).toEqual([{ owner: "octo", name: "b" }]);
  });
});

describe("listAccessibleRepositories", () => {
  it("lists the viewer's repositories, newest push first as GitHub returns them", async () => {
    const { client: c, fake } = client({
      "GET /user/repos": { body: [repo("octo", "a"), repo("org", "b", { private: true })] },
    });
    const result = await listAccessibleRepositories(c);
    expect(result.repositories.map((r) => r.fullName)).toEqual(["octo/a", "org/b"]);
    expect(result.complete).toBe(true);
    expect(fake.calls[0]?.query).toMatchObject({
      sort: "pushed",
      affiliation: "owner,collaborator,organization_member",
    });
  });

  it("copes with a viewer who has no repositories", async () => {
    const { client: c } = client({ "GET /user/repos": { body: [] } });
    expect(await listAccessibleRepositories(c)).toEqual({ repositories: [], complete: true });
  });

  it("reports when the list was cut short by the page cap", async () => {
    const { client: c } = client({
      "GET /user/repos": (request) => {
        const page = Number(request.url.searchParams.get("page") ?? 1);
        return {
          body: [repo("octo", `r${page}`)],
          headers: { link: `<https://api.github.com/user/repos?page=${page + 1}>; rel="next"` },
        };
      },
    });
    expect((await listAccessibleRepositories(c)).complete).toBe(false);
  });

  it("detects private-repository access from the granted scopes", () => {
    expect(hasPrivateAccess(["read:user"])).toBe(false);
    expect(hasPrivateAccess([])).toBe(false);
    expect(hasPrivateAccess(["read:user", "repo"])).toBe(true);
    expect(hasPrivateAccess(["public_repo"])).toBe(false);
  });
});

describe("readRateLimit", () => {
  it("reads the core quota", async () => {
    const reset = Math.floor(Date.now() / 1000) + 1200;
    const { client: c } = client({
      "GET /rate_limit": { body: { resources: { core: { limit: 5000, remaining: 4321, reset } } } },
    });
    expect(await readRateLimit(c)).toEqual({
      limit: 5000,
      remaining: 4321,
      resetAt: new Date(reset * 1000),
    });
  });

  it("returns null (not an error) when it cannot be read", async () => {
    expect(
      await readRateLimit(client({ "GET /rate_limit": { status: 500, body: {} } }).client),
    ).toBeNull();
    expect(
      await readRateLimit(client({ "GET /rate_limit": { body: { nope: true } } }).client),
    ).toBeNull();
  });
});

describe("revokeGitHubToken", () => {
  const options = { clientId: "Iv1.abc", clientSecret: "s3cret", accessToken: "gho_usertoken" };

  it("authenticates as the OAuth app (never with the user's token) and sends the token in the body", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(null, { status: 204 });
    };
    expect(await revokeGitHubToken(options, fetchImpl)).toEqual({ revoked: true });

    expect(seen?.url).toBe("https://api.github.com/applications/Iv1.abc/token");
    expect(seen?.init.method).toBe("DELETE");
    const headers = seen?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("Iv1.abc:s3cret").toString("base64")}`);
    expect(JSON.stringify(headers)).not.toContain("gho_usertoken"); // token is in the body, not a header
    expect(JSON.parse(String(seen?.init.body))).toEqual({ access_token: "gho_usertoken" });
  });

  it("treats an already-invalid token (404) as revoked", async () => {
    expect(
      await revokeGitHubToken(options, async () => new Response(null, { status: 404 })),
    ).toEqual({ revoked: true });
  });

  it("reports failure without leaking secrets", async () => {
    const result = await revokeGitHubToken(
      options,
      async () => new Response("{}", { status: 500 }),
    );
    expect(result).toEqual({ revoked: false, reason: "GitHub answered HTTP 500" });
    const network = await revokeGitHubToken(options, async () => {
      throw new TypeError("connect ECONNREFUSED with s3cret");
    });
    expect(JSON.stringify(network)).not.toContain("s3cret");
    expect(network.revoked).toBe(false);
  });
});

describe("PrismaSelectionStore", () => {
  function fakePrisma() {
    const rows: Array<{ userId: string; owner: string; name: string; createdAt: number }> = [];
    let tick = 0;
    const calls: string[] = [];
    const delegate = {
      findMany: async (args: { where: { userId: string } }) => {
        calls.push("findMany");
        return rows
          .filter((r) => r.userId === args.where.userId)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(({ owner, name }) => ({ owner, name }));
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        calls.push("deleteMany");
        for (let i = rows.length - 1; i >= 0; i -= 1)
          if (rows[i]?.userId === args.where.userId) rows.splice(i, 1);
      },
      createMany: async (args: {
        data: Array<{ userId: string; owner: string; name: string }>;
      }) => {
        calls.push("createMany");
        for (const row of args.data) rows.push({ ...row, createdAt: tick++ });
      },
    };
    const prisma: SelectionPrisma = {
      selectedRepository: delegate,
      $transaction: async (fn) => {
        calls.push("begin");
        return fn(prisma);
      },
    };
    return { prisma, calls, rows };
  }

  it("replaces a user's selection inside one transaction and scopes every query to that user", async () => {
    const { prisma, calls, rows } = fakePrisma();
    const store = new PrismaSelectionStore(prisma);
    await store.replace("u1", [{ owner: "a", name: "x" }]);
    await store.replace("u2", [{ owner: "b", name: "y" }]);
    await store.replace("u1", [{ owner: "a", name: "z" }]);

    expect(calls.filter((c) => c === "begin")).toHaveLength(3);
    expect(await store.list("u1")).toEqual([{ owner: "a", name: "z" }]);
    expect(await store.list("u2")).toEqual([{ owner: "b", name: "y" }]); // untouched by u1's changes
    expect(rows).toHaveLength(2);
  });

  it("clears the selection when given an empty list", async () => {
    const { prisma } = fakePrisma();
    const store = new PrismaSelectionStore(prisma);
    await store.replace("u1", [{ owner: "a", name: "x" }]);
    await store.replace("u1", []);
    expect(await store.list("u1")).toEqual([]);
  });
});
