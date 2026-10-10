import { describe, expect, it } from "vitest";
import { NOW } from "@/test/builders";
import {
  formatCompact,
  formatDurationSeconds,
  formatHours,
  formatPercent,
  formatRelative,
  formatShortDate,
  pluralize,
} from "./format";

describe("formatCompact", () => {
  it("keeps small numbers whole and compacts large ones", () => {
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1284)).toBe("1.3K");
    expect(formatCompact(12_900)).toBe("12.9K");
  });
});

describe("formatDurationSeconds", () => {
  it.each([
    [null, "—"],
    [45, "45s"],
    [135, "2m 15s"],
    [4000, "1h 6m"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatDurationSeconds(input)).toBe(expected);
  });
});

describe("formatHours", () => {
  it.each([
    [null, "—"],
    [0.25, "15m"],
    [5.44, "5.4h"],
    [52, "2.2d"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatHours(input)).toBe(expected);
  });
});

describe("formatRelative", () => {
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  it.each([
    [30_000, "just now"],
    [5 * 60_000, "5 min ago"],
    [3 * 3_600_000, "3 hours ago"],
    [1 * 3_600_000, "1 hour ago"],
    [26 * 3_600_000, "yesterday"],
    [5 * 86_400_000, "5 days ago"],
    [21 * 86_400_000, "3 weeks ago"],
    [90 * 86_400_000, "3 months ago"],
  ])("formats a %s ms gap as %s", (gap, expected) => {
    expect(formatRelative(at(gap), NOW)).toBe(expected);
  });

  it("does not show negative time for future timestamps or crash on bad input", () => {
    expect(formatRelative(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe("just now");
    expect(formatRelative("not a date", NOW)).toBe("—");
  });
});

describe("misc", () => {
  it("formats percentages, dates and plurals", () => {
    expect(formatPercent(0.756)).toBe("76%");
    expect(formatPercent(0.756, 1)).toBe("75.6%");
    expect(formatShortDate("2026-06-14T23:30:00Z")).toBe("Jun 14");
    expect(pluralize(1, "run")).toBe("1 run");
    expect(pluralize(1200, "run")).toBe("1,200 runs");
  });
});
