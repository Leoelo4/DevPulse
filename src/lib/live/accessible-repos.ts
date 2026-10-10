import type { Repository } from "@/lib/domain/types";
import type { GitHubClient } from "@/lib/github/client";
import { fetchPaginated } from "@/lib/github/paginate";
import { parseRepositories } from "@/lib/github/parse";

export interface AccessibleRepositories {
  repositories: Repository[];
  /** `false` when the viewer has more repositories than the pages DevPulse reads. */
  complete: boolean;
}

const MAX_PAGES = 3;

/**
 * Repositories the viewer's token can read, for the onboarding picker. With a public-only
 * authorization GitHub returns only public repositories; private ones appear once private access
 * has been granted. Archived repositories are listed (they have history worth reading).
 */
export async function listAccessibleRepositories(
  client: Pick<GitHubClient, "paginate">,
): Promise<AccessibleRepositories> {
  const page = await fetchPaginated(
    client,
    "GET /user/repos",
    { sort: "pushed", affiliation: "owner,collaborator,organization_member" },
    { maxPages: MAX_PAGES },
  );
  const { items } = parseRepositories(page.items);
  return { repositories: items, complete: page.complete };
}

/** Whether the granted OAuth scopes include access to private repositories. */
export function hasPrivateAccess(scopes: readonly string[]): boolean {
  return scopes.includes("repo");
}
