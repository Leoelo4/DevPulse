"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";
import { getGitHubCredentials, ReconnectRequiredError } from "@/lib/auth/session";
import { requireLiveViewer } from "@/lib/auth/viewer";
import { getDataCache, invalidateUserData } from "@/lib/cache/shared";
import { getPrisma } from "@/lib/db/prisma";
import { getLiveModeStatus, requireLiveConfig } from "@/lib/env";
import { createViewerClient, getSelectionStore } from "@/lib/live/live-source";
import { revokeGitHubToken, type RevokeResult } from "@/lib/live/revoke-token";
import { saveSelection } from "@/lib/live/selection-service";

/**
 * Server actions for live mode. Each one re-validates the session on the server (`requireLiveViewer`)
 * and never trusts identifiers from the client: the user id always comes from the session.
 */

async function beginGitHubAuthorization(scopes?: string[]): Promise<never> {
  const result = await getAuth().api.signInSocial({
    body: {
      provider: "github",
      callbackURL: "/onboarding",
      errorCallbackURL: "/?auth_error=1",
      ...(scopes ? { scopes } : {}),
    },
    headers: await headers(),
  });
  redirect(result.url ?? "/?auth_error=1");
}

/** Starts GitHub sign-in with the minimum permissions (public data only). */
export async function signInWithGitHub(): Promise<void> {
  if (!getLiveModeStatus().enabled) redirect("/");
  await beginGitHubAuthorization();
}

/**
 * Opt-in to private-repository access. GitHub's OAuth `repo` scope is broad (it also allows writes),
 * so this is never requested by default; DevPulse only ever reads.
 */
export async function requestPrivateAccess(): Promise<void> {
  await requireLiveViewer();
  await beginGitHubAuthorization(["repo"]);
}

export interface SelectionFormState {
  status: "idle" | "error";
  message?: string;
}

export async function saveSelectedRepositories(
  _previous: SelectionFormState,
  formData: FormData,
): Promise<SelectionFormState> {
  const viewer = await requireLiveViewer();

  let message: string | undefined;
  try {
    const { client } = await createViewerClient(viewer.userId);
    const result = await saveSelection(
      { userId: viewer.userId, client, store: getSelectionStore(), cache: getDataCache() },
      formData.getAll("repos"),
    );
    if (!result.ok) message = result.error;
  } catch (error) {
    if (error instanceof ReconnectRequiredError) redirect("/?reconnect=1");
    throw error;
  }

  if (message) return { status: "error", message };
  revalidatePath("/", "layout");
  redirect("/overview");
}

/** Manual refresh: forget this user's cached data so the next render asks GitHub again. */
export async function refreshData(): Promise<void> {
  const viewer = await requireLiveViewer();
  invalidateUserData(viewer.userId);
  revalidatePath("/", "layout");
}

/**
 * Disconnect: revoke the OAuth grant at GitHub (best effort), end the session, and delete every
 * piece of the user's data from DevPulse (user, sessions, tokens, selected repositories).
 */
export async function disconnectAccount(): Promise<void> {
  const viewer = await requireLiveViewer();
  const config = requireLiveConfig();

  let revoke: RevokeResult = { revoked: false, reason: "No token available" };
  try {
    const { accessToken } = await getGitHubCredentials();
    revoke = await revokeGitHubToken({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
      accessToken,
    });
  } catch {
    // The token may already be unusable; local deletion below still proceeds.
  }

  invalidateUserData(viewer.userId);
  await getAuth().api.signOut({ headers: await headers() });
  // Sessions, accounts (encrypted tokens) and selections are removed by cascading foreign keys.
  await getPrisma().user.delete({ where: { id: viewer.userId } });

  redirect(revoke.revoked ? "/?disconnected=1" : "/?disconnected=partial");
}
