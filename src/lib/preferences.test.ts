import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "@/lib/metrics/thresholds";
import {
  DEFAULT_PREFERENCES,
  parseStoredPreferences,
  parseStoredThresholds,
  serializePreferences,
  thresholdsInputSchema,
} from "./preferences";

describe("parseStoredPreferences", () => {
  it("returns defaults when nothing is stored", () => {
    expect(parseStoredPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parseStoredPreferences("")).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips valid values", () => {
    const custom = {
      thresholds: { stalePullRequestDays: 7, staleIssueDays: 60, releaseOverdueDays: 30 },
      refreshMode: "conservative" as const,
    };
    expect(parseStoredPreferences(serializePreferences(custom))).toEqual(custom);
  });

  it("falls back to defaults for malformed JSON instead of throwing", () => {
    for (const raw of ["{not json", "null", "42", "[]", '"str"']) {
      expect(parseStoredPreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it("replaces only the invalid fields with defaults (tampered or out-of-range values)", () => {
    const stored = JSON.stringify({
      thresholds: { stalePullRequestDays: -5, staleIssueDays: 45, releaseOverdueDays: "abc" },
      refreshMode: "every-second",
    });
    expect(parseStoredPreferences(stored)).toEqual({
      thresholds: {
        stalePullRequestDays: DEFAULT_THRESHOLDS.stalePullRequestDays,
        staleIssueDays: 45,
        releaseOverdueDays: DEFAULT_THRESHOLDS.releaseOverdueDays,
      },
      refreshMode: "standard",
    });
  });

  it("still reads the original flat, thresholds-only cookie", () => {
    const legacy = JSON.stringify({
      stalePullRequestDays: 9,
      staleIssueDays: 20,
      releaseOverdueDays: 50,
    });
    expect(parseStoredPreferences(legacy)).toEqual({
      thresholds: { stalePullRequestDays: 9, staleIssueDays: 20, releaseOverdueDays: 50 },
      refreshMode: "standard",
    });
  });

  it("only accepts known refresh modes", () => {
    for (const mode of ["fresh", "standard", "conservative"]) {
      expect(parseStoredPreferences(JSON.stringify({ refreshMode: mode })).refreshMode).toBe(mode);
    }
    expect(parseStoredPreferences(JSON.stringify({ refreshMode: "__proto__" })).refreshMode).toBe(
      "standard",
    );
  });

  it("does not let a stored prototype-pollution payload leak into the result", () => {
    const parsed = parseStoredPreferences(
      '{"__proto__":{"polluted":true},"thresholds":{"constructor":1}}',
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(parsed).toEqual(DEFAULT_PREFERENCES);
  });
});

describe("parseStoredThresholds", () => {
  it("returns just the thresholds", () => {
    expect(parseStoredThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
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
