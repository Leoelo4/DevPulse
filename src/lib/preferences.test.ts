import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "@/lib/metrics/thresholds";
import { parseStoredThresholds, serializeThresholds, thresholdsInputSchema } from "./preferences";

describe("parseStoredThresholds", () => {
  it("returns defaults when nothing is stored", () => {
    expect(parseStoredThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
    expect(parseStoredThresholds("")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("round-trips valid values", () => {
    const custom = { stalePullRequestDays: 7, staleIssueDays: 60, releaseOverdueDays: 30 };
    expect(parseStoredThresholds(serializeThresholds(custom))).toEqual(custom);
  });

  it("falls back to defaults for malformed JSON instead of throwing", () => {
    expect(parseStoredThresholds("{not json")).toEqual(DEFAULT_THRESHOLDS);
    expect(parseStoredThresholds("null")).toEqual(DEFAULT_THRESHOLDS);
    expect(parseStoredThresholds("42")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("replaces only the invalid fields with defaults (tampered or out-of-range values)", () => {
    const stored = JSON.stringify({
      stalePullRequestDays: -5,
      staleIssueDays: 45,
      releaseOverdueDays: "abc",
    });
    expect(parseStoredThresholds(stored)).toEqual({
      stalePullRequestDays: DEFAULT_THRESHOLDS.stalePullRequestDays,
      staleIssueDays: 45,
      releaseOverdueDays: DEFAULT_THRESHOLDS.releaseOverdueDays,
    });
  });
});

describe("thresholdsInputSchema (form validation)", () => {
  it("coerces form strings to integers", () => {
    const parsed = thresholdsInputSchema.safeParse({
      stalePullRequestDays: "10",
      staleIssueDays: "20",
      releaseOverdueDays: "90",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.stalePullRequestDays).toBe(10);
  });

  it("rejects fractions, out-of-range and non-numeric input with readable messages", () => {
    const parsed = thresholdsInputSchema.safeParse({
      stalePullRequestDays: "2.5",
      staleIssueDays: "9999",
      releaseOverdueDays: "soon",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      expect(fields.stalePullRequestDays?.[0]).toMatch(/whole number/);
      expect(fields.staleIssueDays?.[0]).toMatch(/at most 365/);
      expect(fields.releaseOverdueDays).toBeDefined();
    }
  });
});
