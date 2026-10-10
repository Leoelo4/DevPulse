import { describe, expect, it, vi } from "vitest";
import { createConditionalFetch, EtagCache, withTimeout } from "./conditional-fetch";

type Call = { url: string; method: string; headers: Headers };

/** A scriptable base fetch that records calls and returns queued responses. */
function scripted(responses: Array<() => Response>) {
  const calls: Call[] = [];
  let i = 0;
  const base: typeof fetch = async (input, init) => {
    calls.push({
      url: typeof input === "string" ? input : String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    });
    const make = responses[Math.min(i, responses.length - 1)] as () => Response;
    i += 1;
    return make();
  };
  return { base, calls };
}

const ok =
  (body: string, etag?: string, extra: Record<string, string> = {}) =>
  () =>
    new Response(body, {
      status: 200,
      headers: { ...(etag ? { etag } : {}), "content-type": "application/json", ...extra },
    });

describe("createConditionalFetch", () => {
  it("sends If-None-Match on repeat requests and replays the stored body on 304", async () => {
    const cache = new EtagCache();
    const { base, calls } = scripted([
      ok('{"a":1}', '"v1"', { link: '<u>; rel="next"' }),
      () => new Response(null, { status: 304, headers: { "x-ratelimit-remaining": "4999" } }),
    ]);
    const fetchImpl = createConditionalFetch(base, cache);

    const first = await fetchImpl("https://api.github.com/x");
    expect(await first.json()).toEqual({ a: 1 });
    expect(calls[0]?.headers.get("if-none-match")).toBeNull();

    const second = await fetchImpl("https://api.github.com/x");
    expect(calls[1]?.headers.get("if-none-match")).toBe('"v1"');
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ a: 1 });
    // Pagination links survive revalidation, and the *current* quota headers are kept.
    expect(second.headers.get("link")).toContain("next");
    expect(second.headers.get("x-ratelimit-remaining")).toBe("4999");
    expect(second.headers.get("x-devpulse-cache")).toBe("revalidated");
  });

  it("replaces the stored body when GitHub returns new content", async () => {
    const cache = new EtagCache();
    const { base, calls } = scripted([
      ok('{"v":1}', '"v1"'),
      ok('{"v":2}', '"v2"'),
      () => new Response(null, { status: 304 }),
    ]);
    const fetchImpl = createConditionalFetch(base, cache);
    await fetchImpl("https://api.github.com/x");
    expect(await (await fetchImpl("https://api.github.com/x")).json()).toEqual({ v: 2 });
    const third = await fetchImpl("https://api.github.com/x");
    expect(calls[2]?.headers.get("if-none-match")).toBe('"v2"');
    expect(await third.json()).toEqual({ v: 2 });
  });

  it("does not interfere with non-GET requests", async () => {
    const cache = new EtagCache();
    const { base, calls } = scripted([ok("{}", '"v1"')]);
    await createConditionalFetch(base, cache)("https://api.github.com/x", { method: "POST" });
    expect(calls[0]?.headers.get("if-none-match")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("does not store responses that have no ETag, or that are errors", async () => {
    const cache = new EtagCache();
    const { base } = scripted([
      ok("{}"),
      () => new Response("{}", { status: 500, headers: { etag: '"e"' } }),
    ]);
    const fetchImpl = createConditionalFetch(base, cache);
    await fetchImpl("https://api.github.com/a");
    await fetchImpl("https://api.github.com/b");
    expect(cache.size).toBe(0);
  });

  it("keys by full URL, so different pages and query strings are cached separately", async () => {
    const cache = new EtagCache();
    const { base } = scripted([ok("{}", '"1"'), ok("{}", '"2"')]);
    const fetchImpl = createConditionalFetch(base, cache);
    await fetchImpl("https://api.github.com/x?page=1");
    await fetchImpl("https://api.github.com/x?page=2");
    expect(cache.size).toBe(2);
  });

  it("isolates users: a separate cache never sees another's entries", async () => {
    const alice = new EtagCache();
    const bob = new EtagCache();
    const { base, calls } = scripted([
      ok('{"private":true}', '"v1"'),
      ok('{"private":true}', '"v1"'),
    ]);
    await createConditionalFetch(base, alice)("https://api.github.com/private-repo");
    await createConditionalFetch(base, bob)("https://api.github.com/private-repo");
    // Bob's request carries no validator derived from Alice's cache.
    expect(calls[1]?.headers.get("if-none-match")).toBeNull();
  });

  it("falls through to the real response if GitHub says 304 but nothing is stored", async () => {
    const cache = new EtagCache();
    const { base } = scripted([() => new Response(null, { status: 304 })]);
    const response = await createConditionalFetch(base, cache)("https://api.github.com/x");
    expect(response.status).toBe(304);
  });
});

describe("EtagCache", () => {
  const entry = (n: number, body = "{}") => ({
    etag: `"${n}"`,
    body,
    status: 200,
    headers: [] as [string, string][],
  });

  it("evicts the least recently used entry past its limit", () => {
    const cache = new EtagCache(2);
    cache.set("a", entry(1));
    cache.set("b", entry(2));
    cache.get("a"); // a is now most recent
    cache.set("c", entry(3));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("c")).toBeDefined();
  });

  it("refuses to store oversized bodies", () => {
    const cache = new EtagCache(10, 5);
    cache.set("big", entry(1, "x".repeat(10)));
    expect(cache.size).toBe(0);
  });
});

describe("withTimeout", () => {
  it("aborts a request that takes too long", async () => {
    const slow: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    await expect(withTimeout(slow, 20)("https://api.github.com/x")).rejects.toBeDefined();
  });

  it("passes fast requests through and respects a caller-supplied signal", async () => {
    const fast = vi.fn<typeof fetch>(async () => new Response("ok"));
    const controller = new AbortController();
    const response = await withTimeout(fast, 1000)("https://api.github.com/x", {
      signal: controller.signal,
    });
    expect(await response.text()).toBe("ok");
    expect(fast).toHaveBeenCalledOnce();
  });
});
