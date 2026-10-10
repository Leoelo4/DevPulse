import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getPrisma } from "@/lib/db/prisma";
import { requireLiveConfig, type LiveConfig } from "@/lib/env";
import { SESSION_COOKIE_PREFIX } from "./constants";

/** GitHub's user profile, as far as account creation needs it. */
interface GitHubProfileLike {
  id: number | string;
  login: string;
  email?: string | null;
}

/**
 * GitHub sign-in without the `user:email` scope has no email to give us, but Better Auth requires
 * one. GitHub's own `users.noreply.github.com` address is the documented stand-in: it is unique per
 * account and never a real mailbox, so no personal data is collected just to satisfy the schema.
 */
export function noreplyEmail(profile: GitHubProfileLike): string {
  return profile.email ?? `${profile.id}+${profile.login}@users.noreply.github.com`;
}

export function createAuth(config: LiveConfig) {
  return betterAuth({
    appName: "DevPulse",
    baseURL: config.appUrl,
    secret: config.authSecret,
    trustedOrigins: [config.appUrl],
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    socialProviders: {
      github: {
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
        // Minimum permissions: with no scopes GitHub grants read access to *public* data only.
        // Private-repository access is a separate, explicit opt-in (see `requestPrivateAccess`).
        disableDefaultScope: true,
        mapProfileToUser: (profile: GitHubProfileLike) => ({ email: noreplyEmail(profile) }),
      },
    },
    account: {
      // OAuth access/refresh tokens are encrypted at rest with the auth secret.
      encryptOAuthTokens: true,
      accountLinking: { enabled: false },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix: SESSION_COOKIE_PREFIX,
      useSecureCookies: config.appUrl.startsWith("https://"),
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { devpulseAuth?: Auth };

/** The shared auth instance, created on first use (only when live mode is configured). */
export function getAuth(): Auth {
  if (!globalForAuth.devpulseAuth) {
    globalForAuth.devpulseAuth = createAuth(requireLiveConfig());
  }
  return globalForAuth.devpulseAuth;
}
