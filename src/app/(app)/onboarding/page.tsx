import { FolderGit2 } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ResourceNotice } from "@/components/common/resource-notice";
import { AccessCard } from "@/components/onboarding/access-card";
import { RepoPicker } from "@/components/onboarding/repo-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireLiveViewer } from "@/lib/auth/viewer";
import { unavailable } from "@/lib/github/errors";
import { createViewerClient, getSelectionStore } from "@/lib/live/live-source";
import { hasPrivateAccess, listAccessibleRepositories } from "@/lib/live/accessible-repos";
import { MAX_SELECTED_REPOSITORIES, repoKey } from "@/lib/repos/selection";
import { ReconnectRequiredError } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Choose repositories" };

export default async function OnboardingPage() {
  const viewer = await requireLiveViewer();
  await connection();

  let client;
  let scopes: string[];
  try {
    ({ client, scopes } = await createViewerClient(viewer.userId));
  } catch (error) {
    if (error instanceof ReconnectRequiredError) redirect("/?reconnect=1");
    throw error;
  }

  const privateAccess = hasPrivateAccess(scopes);
  const [selected, accessible] = await Promise.all([
    getSelectionStore().list(viewer.userId),
    listAccessibleRepositories(client).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, failure: unavailable(error) }),
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Choose repositories"
        description={`Pick up to ${MAX_SELECTED_REPOSITORIES} repositories to track. You can change this any time.`}
      />

      <AccessCard privateAccess={privateAccess} userName={viewer.name} />

      <Card>
        <CardHeader>
          <CardTitle>Your repositories</CardTitle>
          <CardDescription>
            Repositories you own or collaborate on
            {privateAccess ? "" : " (public only until you enable private access)"}. DevPulse saves
            only the names you choose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!accessible.ok ? (
            <ResourceNotice resource={accessible.failure} label="Your repositories" />
          ) : accessible.result.repositories.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No repositories found"
              description={
                privateAccess
                  ? "GitHub returned no repositories for your account. If you expected some, check that any organization that owns them has approved DevPulse."
                  : "No public repositories were found for your account. To analyse private repositories, enable private access above."
              }
            />
          ) : (
            <RepoPicker
              repos={accessible.result.repositories.map((repo) => ({
                fullName: repo.fullName,
                description: repo.description,
                language: repo.primaryLanguage,
                isPrivate: repo.isPrivate,
                isArchived: repo.isArchived,
              }))}
              initiallySelected={selected.map(repoKey)}
              max={MAX_SELECTED_REPOSITORIES}
              truncated={!accessible.result.complete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
