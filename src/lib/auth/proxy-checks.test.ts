import { describe, expect, it } from "vitest";
import { hasMalformedEncoding, hasSignInCookie } from "./proxy-checks";

const cookies =
  (...names: string[]) =>
  (name: string) =>
    names.includes(name);

describe("hasSignInCookie (optimistic proxy gate)", () => {
  it("lets visitors with a demo or session cookie through to the server-side checks", () => {
    expect(hasSignInCookie(cookies("devpulse-mode"))).toBe(true);
    expect(hasSignInCookie(cookies("devpulse.session_token"))).toBe(true);
    expect(hasSignInCookie(cookies("__Secure-devpulse.session_token"))).toBe(true);
  });

  it("redirects visitors with no relevant cookie", () => {
    expect(hasSignInCookie(cookies())).toBe(false);
    expect(hasSignInCookie(cookies("theme", "devpulse-prefs"))).toBe(false);
  });

  it("does not accept another app's session cookie", () => {
    expect(hasSignInCookie(cookies("better-auth.session_token", "session"))).toBe(false);
  });
});

describe("hasMalformedEncoding", () => {
  it("flags invalid percent-encoding and accepts valid paths", () => {
    expect(hasMalformedEncoding("/repositories/o/%E0%A4%A")).toBe(true);
    expect(hasMalformedEncoding("/repositories/o/%")).toBe(true);
    expect(hasMalformedEncoding("/repositories/o/r")).toBe(false);
    expect(hasMalformedEncoding("/repositories/o/caf%C3%A9")).toBe(false);
  });
});
