import { describe, expect, it } from "vitest";
import { NOW } from "@/test/builders";
import type { RepositorySnapshot } from "@/lib/domain/types";
import { buildOverview } from "@/lib/metrics/overview";
import { generateDemoSnapshot, generateDemoSnapshots } from "./generate";
import { createRng, hashSeed } from "./prng";
import { DEMO_OWNER, DEMO_PROFILES } from "./profiles";
import { DemoDataSource } from "./source";

const snapshots = generateDemoSnapshots(NOW);
const ts = Date.parse;

describe("prng", () => {
  it("is deterministic for a given seed and differs across seeds", () => {
    const a = createRng(hashSeed("x"));
    const b = createRng(hashSeed("x"));
    const c = createRng(hashSeed("y"));
    const seq = (r: ReturnType<typeof createRng>) => Array.from({ length: 5 }, () => r.next());
    expect(seq(a)).toEqual(seq(b));
    expect(seq(createRng(hashSeed("x")))).not.toEqual(seq(c));
  });
});

describe("demo snapshots", () => {
  it("are labelled as demo data with an explicit caveat", () => {
    for (const snap of snapshots) {
      expect(snap.meta.mode).toBe("demo");
      expect(snap.meta.caveats.join(" ")).toMatch(/sample data/i);
    }
  });

  it("are deterministic: the same `now` yields identical output", () => {
    expect(generateDemoSnapshots(NOW)).toEqual(generateDemoSnapshots(NOW));
  });

  it("never link to GitHub, since sample repositories have no GitHub counterpart", () => {
    const json = JSON.stringify(snapshots);
    expect(json).not.toContain("github.com");
    for (const snap of snapshots) expect(snap.repository.htmlUrl).toBeNull();
  });

  it("only use obviously fictional identities", () => {
    const logins = new Set<string>();
    for (const snap of snapshots) {
      expect(snap.repository.owner).toBe(DEMO_OWNER);
      if (snap.contributors.status === "ok")
        snap.contributors.data.forEach((c) => logins.add(c.login));
      if (snap.pullRequests.status === "ok")
        snap.pullRequests.data.forEach((p) => p.author && logins.add(p.author));
    }
    expect([...logins].every((login) => /^sample-(dev|user)-\d\d$/.test(login))).toBe(true);
  });

  it("covers every profile and unique, increasing PR numbers", () => {
    expect(snapshots).toHaveLength(DEMO_PROFILES.length);
    for (const snap of snapshots) {
      if (snap.pullRequests.status !== "ok") throw new Error("expected PRs");
      const numbers = snap.pullRequests.data.map((p) => p.number);
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });
});

describe("demo data invariants (chronology and consistency)", () => {
  const each = <T>(
    pick: (s: RepositorySnapshot) => T[] | undefined,
    check: (item: T, s: RepositorySnapshot) => void,
  ) => {
    for (const snap of snapshots) for (const item of pick(snap) ?? []) check(item, snap);
  };

  it("pull requests never end before they start, and never in the future", () => {
    each(
      (s) => (s.pullRequests.status === "ok" ? s.pullRequests.data : []),
      (p) => {
        expect(ts(p.updatedAt)).toBeGreaterThanOrEqual(ts(p.createdAt));
        expect(ts(p.updatedAt)).toBeLessThanOrEqual(NOW.getTime());
        if (p.mergedAt) {
          expect(ts(p.mergedAt)).toBeGreaterThanOrEqual(ts(p.createdAt));
          expect(ts(p.mergedAt)).toBeLessThanOrEqual(NOW.getTime());
          expect(p.merged).toBe(true);
          expect(p.state).toBe("closed");
        }
        if (p.state === "open") {
          expect(p.closedAt).toBeNull();
          expect(p.merged).toBe(false);
        }
      },
    );
  });

  it("issues are chronologically consistent", () => {
    each(
      (s) => (s.issues.status === "ok" ? s.issues.data : []),
      (i) => {
        expect(ts(i.updatedAt)).toBeGreaterThanOrEqual(ts(i.createdAt));
        expect(ts(i.updatedAt)).toBeLessThanOrEqual(NOW.getTime());
        if (i.closedAt) expect(ts(i.closedAt)).toBeGreaterThanOrEqual(ts(i.createdAt));
        expect(i.state === "closed").toBe(i.closedAt !== null);
        if (i.firstResponse.status === "responded") {
          expect(ts(i.firstResponse.at)).toBeGreaterThanOrEqual(ts(i.createdAt));
          expect(ts(i.firstResponse.at)).toBeLessThanOrEqual(NOW.getTime());
        }
      },
    );
  });

  it("workflow runs finish after they start and are not in the future", () => {
    each(
      (s) => (s.workflowRuns.status === "ok" ? s.workflowRuns.data : []),
      (r) => {
        expect(ts(r.updatedAt)).toBeGreaterThan(ts(r.createdAt));
        expect(ts(r.createdAt)).toBeLessThan(NOW.getTime());
        expect(r.durationSeconds).toBeGreaterThan(0);
      },
    );
  });

  it("releases are in the past, with semver-style tags", () => {
    each(
      (s) => (s.releases.status === "ok" ? s.releases.data : []),
      (r) => {
        expect(ts(r.publishedAt as string)).toBeLessThan(NOW.getTime());
        expect(r.tagName).toMatch(/^v\d+\.\d+\.\d+$/);
      },
    );
  });

  it("commit activity has 52 consecutive weeks of non-negative counts", () => {
    for (const snap of snapshots) {
      if (snap.commitActivity.status !== "ok") throw new Error("expected commits");
      expect(snap.commitActivity.data).toHaveLength(52);
      expect(snap.commitActivity.data.every((w) => w.commits >= 0)).toBe(true);
    }
  });

  it("repository open counts match the generated PRs and issues", () => {
    for (const snap of snapshots) {
      if (snap.pullRequests.status !== "ok" || snap.issues.status !== "ok")
        throw new Error("expected data");
      const open =
        snap.pullRequests.data.filter((p) => p.state === "open").length +
        snap.issues.data.filter((i) => i.state === "open").length;
      expect(snap.repository.openIssuesAndPullsCount).toBe(open);
    }
  });

  it("honours the profile-forced CI outcome on the default branch", () => {
    for (const [index, profile] of DEMO_PROFILES.entries()) {
      const snap = snapshots[index];
      if (snap?.workflowRuns.status !== "ok") throw new Error("expected runs");
      const first = profile.workflows[0]?.name;
      const latest = snap.workflowRuns.data.find((r) => r.branch === "main" && r.name === first);
      expect(latest?.conclusion).toBe(profile.latestMainRun);
    }
  });
});

describe("demo variety", () => {
  it("includes both healthy and struggling repositories so every UI state is exercised", () => {
    const overview = buildOverview(snapshots, NOW);
    const levels = new Set(overview.health.map((h) => h.summary.level));
    expect(levels.size).toBeGreaterThanOrEqual(2);
    expect(overview.workflowFailuresLast7Days.value).toBeGreaterThan(0);
    expect(overview.openPullRequests.value).toBeGreaterThan(0);
    expect(overview.recentReleases.length).toBeGreaterThan(0);
  });

  it("includes a repository that does not use GitHub Deployments", () => {
    const withoutDeployments = snapshots.filter((s) => s.deployments.status === "unavailable");
    expect(withoutDeployments.length).toBeGreaterThan(0);
  });
});

describe("DemoDataSource", () => {
  const source = new DemoDataSource(NOW);

  it("lists all sample repositories", async () => {
    expect(source.mode).toBe("demo");
    expect(await source.getSnapshots()).toHaveLength(DEMO_PROFILES.length);
  });

  it("looks up a single repository, and returns null for unknown ones", async () => {
    const snap = await source.getSnapshot(DEMO_OWNER, "pulse-api");
    expect(snap?.repository.fullName).toBe("sample-org/pulse-api");
    expect(await source.getSnapshot(DEMO_OWNER, "nope")).toBeNull();
    expect(await source.getSnapshot("someone-else", "pulse-api")).toBeNull();
  });

  it("generateDemoSnapshot agrees with the bulk generator", () => {
    expect(generateDemoSnapshot(DEMO_OWNER, "cli-tools", NOW)).toEqual(
      snapshots.find((s) => s.repository.name === "cli-tools"),
    );
  });
});
