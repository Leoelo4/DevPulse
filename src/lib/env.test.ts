import { describe, expect, it } from "vitest";
import { evaluateLiveMode } from "./env";

const FULL = {
  DATABASE_URL: "postgresql://devpulse:devpulse@localhost:5432/devpulse",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
};

describe("evaluateLiveMode", () => {
  it("is disabled, listing everything missing, when nothing is configured (demo-only setup)", () => {
    const status = evaluateLiveMode({});
    expect(status).toMatchObject({ enabled: false });
    if (!status.enabled) {
      expect(status.missing).toEqual([
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
      ]);
    }
  });

  it("is enabled when every variable is present and valid", () => {
    const status = evaluateLiveMode(FULL);
    expect(status.enabled).toBe(true);
    if (status.enabled) {
      expect(status.config.githubClientId).toBe("client-id");
      expect(status.config.appUrl).toBe("http://localhost:3000");
    }
  });

  it("reports only the variables that are missing from a partial configuration", () => {
    const { GITHUB_CLIENT_SECRET: _omit, ...rest } = FULL;
    const status = evaluateLiveMode(rest);
    expect(status.enabled).toBe(false);
    if (!status.enabled) expect(status.missing).toEqual(["GITHUB_CLIENT_SECRET"]);
  });

  it("treats blank strings as missing", () => {
    const status = evaluateLiveMode({ ...FULL, GITHUB_CLIENT_ID: "   " });
    expect(status.enabled).toBe(false);
    if (!status.enabled) expect(status.missing).toContain("GITHUB_CLIENT_ID");
  });

  it("rejects a short auth secret and explains why", () => {
    const status = evaluateLiveMode({ ...FULL, BETTER_AUTH_SECRET: "too-short" });
    expect(status.enabled).toBe(false);
    if (!status.enabled) {
      expect(status.invalid.join(" ")).toMatch(/BETTER_AUTH_SECRET.*32 characters/);
    }
  });

  it("rejects malformed URLs", () => {
    const status = evaluateLiveMode({ ...FULL, BETTER_AUTH_URL: "not a url" });
    expect(status.enabled).toBe(false);
    if (!status.enabled) expect(status.invalid.join(" ")).toContain("BETTER_AUTH_URL");
  });
});
