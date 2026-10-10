import { describe, expect, it } from "vitest";
import { daysAgo, NOW, release } from "@/test/builders";
import { summarizeReleases } from "./releases";

describe("summarizeReleases", () => {
  it("finds the latest published release and days since", () => {
    const summary = summarizeReleases(
      [release({ publishedAt: daysAgo(40) }), release({ id: 99, publishedAt: daysAgo(5) })],
      NOW,
    );
    expect(summary.latest?.id).toBe(99);
    expect(summary.daysSinceLatest).toBe(5);
  });

  it("ignores drafts and releases without a publish date", () => {
    const summary = summarizeReleases(
      [release({ draft: true, publishedAt: daysAgo(1) }), release({ publishedAt: null })],
      NOW,
    );
    expect(summary.latest).toBeNull();
    expect(summary.daysSinceLatest).toBeNull();
  });

  it("computes the median gap between consecutive releases", () => {
    const summary = summarizeReleases(
      [
        release({ publishedAt: daysAgo(2) }),
        release({ publishedAt: daysAgo(12) }), // 10d gap
        release({ publishedAt: daysAgo(42) }), // 30d gap
        release({ publishedAt: daysAgo(52) }), // 10d gap
      ],
      NOW,
    );
    expect(summary.medianDaysBetween).toBeCloseTo(10);
  });

  it("needs two releases for a cadence", () => {
    expect(summarizeReleases([release()], NOW).medianDaysBetween).toBeNull();
    expect(summarizeReleases([], NOW).medianDaysBetween).toBeNull();
  });
});
