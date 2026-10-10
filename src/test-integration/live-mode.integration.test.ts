/**
 * Integration tests for live mode's persistence and authentication wiring, against a REAL PostgreSQL
 * database and the real Better Auth instance. They do not call GitHub (OAuth code exchange needs a
 * real OAuth app); everything up to and after that exchange is exercised.
 *
 * Safety: these only run when INTEGRATION_DATABASE_URL is set — a variable deliberately different
 * from DATABASE_URL so they can never be pointed at a development or production database by
 * accident. They only create and delete rows they created themselves.
 *
 *   INTEGRATION_DATABASE_URL=postgresql://... npx prisma migrate deploy   # (with DATABASE_URL set to the same)
 *   INTEGRATION_DATABASE_URL=postgresql://... npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Type-only imports: the real modules are loaded dynamically below, after the environment is set.
import type { createAuth } from "@/lib/auth/auth";
import type { getPrisma } from "@/lib/db/prisma";
import type { requireLiveConfig } from "@/lib/env";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)("live mode against a real database", () => {
  const secret = "integration-test-secret-integration-test-secret";
  let prisma: ReturnType<typeof getPrisma>;
  let auth: ReturnType<typeof createAuth>;
  let config: ReturnType<typeof requireLiveConfig>;
  const createdUserIds: string[] = [];
  let verificationsBefore = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET = secret;
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.GITHUB_CLIENT_ID = "Iv1.testclient";
    process.env.GITHUB_CLIENT_SECRET = "testsecret";

    ({ getPrisma: getPrismaFn } = await import("@/lib/db/prisma"));
    prisma = getPrismaFn();
    config = (await import("@/lib/env")).requireLiveConfig();
    auth = (await import("@/lib/auth/auth")).createAuth(config);
    verificationsBefore = await prisma.verification.count();
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma?.verification.deleteMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
        expiresAt: { gt: new Date() },
      },
    });
    await prisma?.$disconnect();
  });

  // `getPrisma` is imported dynamically (after env is set); keep a handle for beforeAll.
  let getPrismaFn: typeof getPrisma;

  describe("selection store (Prisma adapter)", () => {
    it("replaces a selection atomically, skips duplicates, and cascades on user deletion", async () => {
      const { PrismaSelectionStore } = await import("@/lib/db/selection-store");
      const user = await prisma.user.create({
        data: {
          id: `int-sel-${Date.now()}`,
          name: "Integration",
          email: `sel-${Date.now()}@integration-check.test`,
        },
      });
      createdUserIds.push(user.id);
      const store = new PrismaSelectionStore(prisma as never);

      await store.replace(user.id, [
        { owner: "octo", name: "a" },
        { owner: "octo", name: "b" },
      ]);
      expect(await store.list(user.id)).toHaveLength(2);

      await store.replace(user.id, [{ owner: "octo", name: "c" }]);
      expect(await store.list(user.id)).toEqual([{ owner: "octo", name: "c" }]);

      await store.replace(user.id, [
        { owner: "x", name: "dup" },
        { owner: "x", name: "dup" },
      ]);
      expect(await store.list(user.id)).toHaveLength(1);

      await prisma.user.delete({ where: { id: user.id } });
      expect(await prisma.selectedRepository.count({ where: { userId: user.id } })).toBe(0);
    });

    it("keeps users' selections separate", async () => {
      const { PrismaSelectionStore } = await import("@/lib/db/selection-store");
      const stamp = Date.now();
      const [a, b] = await Promise.all(
        ["a", "b"].map((n) =>
          prisma.user.create({
            data: {
              id: `int-iso-${n}-${stamp}`,
              name: n,
              email: `${n}-${stamp}@integration-check.test`,
            },
          }),
        ),
      );
      createdUserIds.push(a!.id, b!.id);
      const store = new PrismaSelectionStore(prisma as never);
      await store.replace(a!.id, [{ owner: "o", name: "mine" }]);
      await store.replace(b!.id, [{ owner: "o", name: "theirs" }]);
      expect(await store.list(a!.id)).toEqual([{ owner: "o", name: "mine" }]);
      expect(await store.list(b!.id)).toEqual([{ owner: "o", name: "theirs" }]);
    });
  });

  describe("GitHub authorization request", () => {
    it("starts with NO scopes (public data only) and points at this app's callback", async () => {
      const result = await auth.api.signInSocial({
        body: { provider: "github", callbackURL: "/onboarding" },
        headers: new Headers(),
      });
      const authorize = new URL(result.url ?? "");
      expect(authorize.origin + authorize.pathname).toBe(
        "https://github.com/login/oauth/authorize",
      );
      expect(authorize.searchParams.get("client_id")).toBe("Iv1.testclient");
      expect(authorize.searchParams.get("scope")).toBeNull();
      expect(authorize.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/auth/callback/github",
      );
      expect((authorize.searchParams.get("state") ?? "").length).toBeGreaterThan(10);
      expect(await prisma.verification.count()).toBeGreaterThan(verificationsBefore); // state persisted
    });

    it("requests exactly the `repo` scope when private access is opted into", async () => {
      const result = await auth.api.signInSocial({
        body: { provider: "github", callbackURL: "/onboarding", scopes: ["repo"] },
        headers: new Headers(),
      });
      expect(new URL(result.url ?? "").searchParams.get("scope")).toBe("repo");
    });
  });

  describe("sessions and stored tokens", () => {
    async function signedInHeaders() {
      const { symmetricEncrypt } = await import("better-auth/crypto");
      const { serializeSignedCookie } = await import("better-call");
      const { noreplyEmail } = await import("@/lib/auth/auth");
      const stamp = Date.now();
      const ctx = await auth.$context;
      const created = await ctx.internalAdapter.createOAuthUser(
        {
          name: "Sam Sample",
          email: noreplyEmail({ id: stamp, login: "sam" }),
          emailVerified: false,
          image: null,
        },
        {
          providerId: "github",
          accountId: String(stamp),
          accessToken: await symmetricEncrypt({
            key: config.authSecret,
            data: "gho_plaintext_token",
          }),
          scope: "repo",
        },
      );
      createdUserIds.push(created.user.id);
      const session = await ctx.internalAdapter.createSession(created.user.id);
      const cookieName = ctx.authCookies.sessionToken.name;
      const cookie = await serializeSignedCookie(cookieName, session.token, config.authSecret);
      return {
        userId: created.user.id,
        cookieName,
        token: session.token,
        email: created.user.email,
        headers: new Headers({ cookie: cookie.split(";")[0] ?? "" }),
      };
    }

    it("uses the cookie name the proxy looks for", async () => {
      const { cookieName } = await signedInHeaders();
      expect(cookieName).toBe("devpulse.session_token");
    });

    it("creates users with GitHub's noreply address (no user:email scope needed)", async () => {
      const { email } = await signedInHeaders();
      expect(email).toMatch(/^\d+\+sam@users\.noreply\.github\.com$/);
    });

    it("validates a signed session cookie and rejects a forged one", async () => {
      const { headers, userId, cookieName, token } = await signedInHeaders();
      expect((await auth.api.getSession({ headers }))?.user.id).toBe(userId);
      const forged = new Headers({ cookie: `${cookieName}=${token}.forgedsignature` });
      expect(await auth.api.getSession({ headers: forged })).toBeNull();
      expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
    });

    it("returns the decrypted GitHub token (and scopes) through the same calls the app makes", async () => {
      const { headers } = await signedInHeaders();
      const accounts = await auth.api.listUserAccounts({ headers });
      const github = accounts.find((account) => account.providerId === "github");
      expect(github?.scopes).toContain("repo");

      const token = await auth.api.getAccessToken({
        body: { accountId: github?.id ?? "" },
        headers,
      });
      expect(token.accessToken).toBe("gho_plaintext_token");
    });

    it("stores the token encrypted at rest", async () => {
      const { userId } = await signedInHeaders();
      const row = await prisma.account.findFirst({ where: { userId } });
      expect(row?.accessToken).toBeTruthy();
      expect(row?.accessToken).not.toContain("gho_plaintext_token");
    });

    it("does not let one user read another user's token by guessing an account id", async () => {
      const alice = await signedInHeaders();
      const bob = await signedInHeaders();
      const bobAccount = (await auth.api.listUserAccounts({ headers: bob.headers })).find(
        (a) => a.providerId === "github",
      );
      await expect(
        auth.api.getAccessToken({
          body: { accountId: bobAccount?.id ?? "" },
          headers: alice.headers,
        }),
      ).rejects.toBeDefined();
    });

    it("sign-out invalidates the session, and deleting the user removes accounts and tokens", async () => {
      const { headers, userId } = await signedInHeaders();
      await auth.api.signOut({ headers });
      expect(await auth.api.getSession({ headers })).toBeNull();

      await prisma.user.delete({ where: { id: userId } });
      expect(await prisma.account.count({ where: { userId } })).toBe(0);
      expect(await prisma.session.count({ where: { userId } })).toBe(0);
    });
  });
});
