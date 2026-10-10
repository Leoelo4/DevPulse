import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./memory-cache";
import {
  BASE_TTL_MS,
  NEGATIVE_TTL_MS,
  REFRESH_MODE_MULTIPLIER,
  isRefreshMode,
  ttlFor,
  ttlForResource,
} from "./freshness";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => void (now += ms) };
}

describe("MemoryCache", () => {
  it("serves a value from memory until its TTL elapses, then reloads", async () => {
    const time = clock();
    const cache = new MemoryCache(10, time.now);
    const loader = vi.fn(async () => "v");

    expect((await cache.getOrLoad("k", 1000, loader)).fromCache).toBe(false);
    expect((await cache.getOrLoad("k", 1000, loader)).fromCache).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);

    time.advance(1001);
    expect((await cache.getOrLoad("k", 1000, loader)).fromCache).toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reports when the cached value was originally fetched", async () => {
    const time = clock(5000);
    const cache = new MemoryCache(10, time.now);
    await cache.getOrLoad("k", 1000, async () => "v");
    time.advance(400);
    expect((await cache.getOrLoad("k", 1000, async () => "v")).fetchedAt).toBe(5000);
  });

  it("shares one in-flight load between concurrent callers (single flight)", async () => {
    const cache = new MemoryCache();
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>((r) => (resolve = r)));

    const calls = [
      cache.getOrLoad("k", 1000, loader),
      cache.getOrLoad("k", 1000, loader),
      cache.getOrLoad("k", 1000, loader),
    ];
    resolve("shared");
    const results = await Promise.all(calls);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.value)).toEqual(["shared", "shared", "shared"]);
  });

  it("does not cache a failed load, and lets the next caller retry", async () => {
    const cache = new MemoryCache();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(cache.getOrLoad("k", 1000, loader)).rejects.toThrow("boom");
    expect((await cache.getOrLoad("k", 1000, loader)).value).toBe("ok");
  });

  it("lets the TTL depend on the loaded value (failures can be cached more briefly)", async () => {
    const time = clock();
    const cache = new MemoryCache(10, time.now);
    const ttl = (v: { ok: boolean }) => (v.ok ? 10_000 : 100);
    await cache.getOrLoad("bad", ttl, async () => ({ ok: false }));
    await cache.getOrLoad("good", ttl, async () => ({ ok: true }));
    time.advance(500);
    expect((await cache.getOrLoad("bad", ttl, async () => ({ ok: false }))).fromCache).toBe(false);
    expect((await cache.getOrLoad("good", ttl, async () => ({ ok: true }))).fromCache).toBe(true);
  });

  it("evicts the least recently used entry beyond its capacity", async () => {
    const cache = new MemoryCache(2);
    await cache.getOrLoad("a", 1e6, async () => 1);
    await cache.getOrLoad("b", 1e6, async () => 2);
    await cache.getOrLoad("a", 1e6, async () => 1); // touch a
    await cache.getOrLoad("c", 1e6, async () => 3);
    expect(cache.size).toBe(2);
    const reloadB = vi.fn(async () => 2);
    await cache.getOrLoad("b", 1e6, reloadB);
    expect(reloadB).toHaveBeenCalled(); // b was evicted
  });

  it("invalidates by prefix only, so one user's refresh never evicts another's data", async () => {
    const cache = new MemoryCache();
    await cache.getOrLoad("user-1:repo:pulls", 1e6, async () => 1);
    await cache.getOrLoad("user-1:repo:issues", 1e6, async () => 1);
    await cache.getOrLoad("user-2:repo:pulls", 1e6, async () => 1);
    expect(cache.invalidate("user-1:")).toBe(2);
    expect(cache.size).toBe(1);
    const reload = vi.fn(async () => 1);
    await cache.getOrLoad("user-2:repo:pulls", 1e6, reload);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("freshness rules", () => {
  it("scales TTLs by refresh mode", () => {
    expect(ttlFor("pullRequests", "standard")).toBe(BASE_TTL_MS.pullRequests);
    expect(ttlFor("pullRequests", "fresh")).toBe(
      BASE_TTL_MS.pullRequests * REFRESH_MODE_MULTIPLIER.fresh,
    );
    expect(ttlFor("pullRequests", "conservative")).toBe(BASE_TTL_MS.pullRequests * 4);
  });

  it("keeps CI data fresher than slow-moving data in every mode", () => {
    for (const mode of ["fresh", "standard", "conservative"] as const) {
      expect(ttlFor("workflowRuns", mode)).toBeLessThan(ttlFor("releases", mode));
      expect(ttlFor("releases", mode)).toBeLessThan(ttlFor("commitActivity", mode));
    }
  });

  it("caches anything that is not a success only briefly", () => {
    expect(ttlForResource("releases", "standard", { status: "ok", data: [], complete: true })).toBe(
      BASE_TTL_MS.releases,
    );
    expect(ttlForResource("releases", "conservative", { status: "pending", message: "x" })).toBe(
      NEGATIVE_TTL_MS,
    );
    expect(
      ttlForResource("releases", "conservative", {
        status: "unavailable",
        reason: "rate_limited",
        message: "x",
      }),
    ).toBe(NEGATIVE_TTL_MS);
  });

  it("validates refresh modes", () => {
    expect(isRefreshMode("fresh")).toBe(true);
    expect(isRefreshMode("hourly")).toBe(false);
    expect(isRefreshMode(undefined)).toBe(false);
  });
});
