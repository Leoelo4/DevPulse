import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW } from "@/test/builders";

// --- mocks for the framework and the (database-backed) session layer ---------------------------
// vi.mock factories are hoisted above everything else, so shared fixtures must be hoisted too.
const mocks = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(readonly target: string) {
      super(`REDIRECT ${target}`);
    }
  }
  class ReconnectRequiredError extends Error {}
  return {
    RedirectError,
    ReconnectRequiredError,
    cookieJar: new Map<string, string>(),
    liveStatus: { enabled: true },
    getSessionUser: vi.fn(),
    createLiveDataSource: vi.fn(),
  };
});
const {
  RedirectError,
  ReconnectRequiredError,
  cookieJar,
  liveStatus,
  getSessionUser,
  createLiveDataSource,
} = mocks;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookieJar.has(name) ? { value: mocks.cookieJar.get(name) } : undefined,
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new mocks.RedirectError(target);
  },
}));
vi.mock("@/lib/env", () => ({ getLiveModeStatus: () => mocks.liveStatus }));
vi.mock("./session", () => ({
  getSessionUser: () => mocks.getSessionUser(),
  ReconnectRequiredError: mocks.ReconnectRequiredError,
}));
vi.mock("@/lib/live/live-source", () => ({
  createLiveDataSource: (...args: unknown[]) => mocks.createLiveDataSource(...args),
}));
import { dataSourceFor, getViewer, requireLiveViewer, requireViewer } from "./viewer";

beforeEach(() => {
  cookieJar.clear();
  liveStatus.enabled = true;
  getSessionUser.mockReset();
  createLiveDataSource.mockReset();
});

const redirectTarget = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RedirectError) return error.target;
    throw error;
  }
  return null;
};

describe("getViewer", () => {
  it("recognises an explicit demo choice without touching the session layer", async () => {
    cookieJar.set("devpulse-mode", "demo");
    expect(await getViewer()).toEqual({ kind: "demo", mode: "demo" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("does not treat a forged mode-cookie value as demo (or as anything else)", async () => {
    liveStatus.enabled = false;
    for (const value of ["admin", "DEMO", "demo ", "true", "live", ""]) {
      cookieJar.set("devpulse-mode", value);
      expect(await getViewer(), `cookie value ${JSON.stringify(value)}`).toBeNull();
    }
  });

  it("is anonymous when live mode is not configured — even if a session cookie exists — and never consults auth", async () => {
    liveStatus.enabled = false;
    cookieJar.set("devpulse.session_token", "anything");
    expect(await getViewer()).toBeNull();
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("returns a live viewer built from the server-validated session, not from request data", async () => {
    cookieJar.set("devpulse.session_token", "claims-to-be-admin");
    getSessionUser.mockResolvedValue({ id: "user-123", name: "Sam Sample", image: null });
    expect(await getViewer()).toEqual({
      kind: "live",
      mode: "live",
      userId: "user-123",
      name: "Sam Sample",
      image: null,
    });
  });

  it("is anonymous when the session is missing or invalid", async () => {
    getSessionUser.mockResolvedValue(null);
    expect(await getViewer()).toBeNull();
  });

  it("an explicit demo choice wins over a live session (so a signed-in user can browse the sample data)", async () => {
    cookieJar.set("devpulse-mode", "demo");
    getSessionUser.mockResolvedValue({ id: "user-123", name: "Sam", image: null });
    expect((await getViewer())?.kind).toBe("demo");
  });
});

describe("requireViewer / requireLiveViewer", () => {
  it("sends anonymous visitors to the landing page", async () => {
    getSessionUser.mockResolvedValue(null);
    expect(await redirectTarget(requireViewer)).toBe("/");
    expect(await redirectTarget(requireLiveViewer)).toBe("/");
  });

  it("lets demo viewers in, but keeps live-only pages (onboarding, repository selection) off-limits", async () => {
    cookieJar.set("devpulse-mode", "demo");
    expect(await redirectTarget(requireViewer)).toBeNull();
    expect(await redirectTarget(requireLiveViewer)).toBe("/overview");
  });

  it("returns the live viewer for signed-in users", async () => {
    getSessionUser.mockResolvedValue({ id: "u", name: "n", image: null });
    expect(await requireLiveViewer()).toMatchObject({ kind: "live", userId: "u" });
  });
});

describe("dataSourceFor", () => {
  const options = { now: NOW, refreshMode: "standard" as const };

  it("gives demo viewers the sample-data source and never loads the live modules", async () => {
    const source = await dataSourceFor({ kind: "demo", mode: "demo" }, options);
    expect(source.mode).toBe("demo");
    expect(createLiveDataSource).not.toHaveBeenCalled();
  });

  it("builds the live source for the session's user id only", async () => {
    createLiveDataSource.mockResolvedValue({ mode: "live" });
    await dataSourceFor(
      { kind: "live", mode: "live", userId: "user-7", name: "n", image: null },
      options,
    );
    expect(createLiveDataSource).toHaveBeenCalledWith("user-7", options);
  });

  it("sends a user whose GitHub grant is unusable back to sign in instead of showing an error", async () => {
    createLiveDataSource.mockRejectedValue(new ReconnectRequiredError("expired"));
    const target = await redirectTarget(() =>
      dataSourceFor({ kind: "live", mode: "live", userId: "u", name: "n", image: null }, options),
    );
    expect(target).toBe("/?reconnect=1");
  });

  it("lets unexpected failures surface to the error boundary", async () => {
    createLiveDataSource.mockRejectedValue(new Error("database down"));
    await expect(
      dataSourceFor({ kind: "live", mode: "live", userId: "u", name: "n", image: null }, options),
    ).rejects.toThrow("database down");
  });
});
