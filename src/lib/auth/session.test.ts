import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "devpulse.session_token=x" }),
}));

const liveStatus = { enabled: true };
vi.mock("@/lib/env", () => ({ getLiveModeStatus: () => liveStatus }));

const api = {
  getSession: vi.fn(),
  listUserAccounts: vi.fn(),
  getAccessToken: vi.fn(),
};
vi.mock("./auth", () => ({ getAuth: () => ({ api }) }));

import { getGitHubCredentials, getSessionUser, ReconnectRequiredError } from "./session";

beforeEach(() => {
  liveStatus.enabled = true;
  for (const fn of Object.values(api)) fn.mockReset();
});

describe("getSessionUser", () => {
  it("returns only the fields the app needs", async () => {
    api.getSession.mockResolvedValue({
      session: { token: "secret-session-token" },
      user: {
        id: "u1",
        name: "Sam",
        image: "https://avatars.githubusercontent.com/u/1",
        email: "x@y.z",
      },
    });
    expect(await getSessionUser()).toEqual({
      id: "u1",
      name: "Sam",
      image: "https://avatars.githubusercontent.com/u/1",
    });
  });

  it("is null when live mode is off, without calling auth", async () => {
    liveStatus.enabled = false;
    expect(await getSessionUser()).toBeNull();
    expect(api.getSession).not.toHaveBeenCalled();
  });

  it("is null when there is no session", async () => {
    api.getSession.mockResolvedValue(null);
    expect(await getSessionUser()).toBeNull();
  });

  it("fails closed: any error during validation means 'not signed in'", async () => {
    api.getSession.mockRejectedValue(new Error("database unreachable"));
    expect(await getSessionUser()).toBeNull();
  });
});

describe("getGitHubCredentials", () => {
  it("fetches the token for the user's own GitHub account via the session", async () => {
    api.listUserAccounts.mockResolvedValue([
      { id: "acc-other", providerId: "credential", scopes: [] },
      { id: "acc-gh", providerId: "github", scopes: ["read:user"] },
    ]);
    api.getAccessToken.mockResolvedValue({ accessToken: "gho_abc", scopes: ["repo"] });

    expect(await getGitHubCredentials()).toEqual({ accessToken: "gho_abc", scopes: ["repo"] });
    expect(api.getAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ body: { accountId: "acc-gh" } }),
    );
  });

  it("falls back to the account's stored scopes when the token response has none", async () => {
    api.listUserAccounts.mockResolvedValue([{ id: "a", providerId: "github", scopes: ["repo"] }]);
    api.getAccessToken.mockResolvedValue({ accessToken: "t" });
    expect((await getGitHubCredentials()).scopes).toEqual(["repo"]);
  });

  it("requires reconnecting when no GitHub account is linked", async () => {
    api.listUserAccounts.mockResolvedValue([]);
    await expect(getGitHubCredentials()).rejects.toBeInstanceOf(ReconnectRequiredError);
  });

  it("requires reconnecting when the token cannot be obtained or refreshed, without leaking the cause", async () => {
    api.listUserAccounts.mockResolvedValue([{ id: "a", providerId: "github", scopes: [] }]);
    api.getAccessToken.mockRejectedValue(new Error("refresh failed: client_secret=abc123"));
    const error = await getGitHubCredentials().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReconnectRequiredError);
    expect(String((error as Error).message)).not.toContain("abc123");
  });
});
