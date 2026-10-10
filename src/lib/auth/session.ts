import "server-only";
import { headers } from "next/headers";
import { getLiveModeStatus } from "@/lib/env";
import { getAuth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  image: string | null;
}

/**
 * The signed-in user, or `null`. Fails closed: if live mode is not configured, or anything about
 * session validation throws (database down, malformed cookie…), the visitor is simply anonymous.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!getLiveModeStatus().enabled) return null;
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) return null;
    return { id: session.user.id, name: session.user.name, image: session.user.image ?? null };
  } catch {
    return null;
  }
}

/** Thrown when the user's GitHub grant is missing, expired or unusable: they must sign in again. */
export class ReconnectRequiredError extends Error {
  override readonly name = "ReconnectRequiredError";
}

export interface GitHubCredentials {
  /** Server-side only. Never serialise this into props, responses or logs. */
  accessToken: string;
  /** OAuth scopes actually granted (e.g. `["repo"]` once private access is enabled). */
  scopes: string[];
}

/**
 * The signed-in user's GitHub access token (decrypted, and refreshed if it has expired). The token
 * leaves this function only to be handed to the GitHub client on the server.
 */
export async function getGitHubCredentials(): Promise<GitHubCredentials> {
  const auth = getAuth();
  const requestHeaders = await headers();
  try {
    const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
    const github = accounts.find((account) => account.providerId === "github");
    if (!github) throw new ReconnectRequiredError("No GitHub account is linked to this session.");

    const token = await auth.api.getAccessToken({
      body: { accountId: github.id },
      headers: requestHeaders,
    });
    return { accessToken: token.accessToken, scopes: token.scopes ?? github.scopes ?? [] };
  } catch (error) {
    if (error instanceof ReconnectRequiredError) throw error;
    throw new ReconnectRequiredError(
      "The GitHub connection could not be used. Please sign in again.",
    );
  }
}
