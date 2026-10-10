import type { MemoryCache } from "@/lib/cache/memory-cache";
import type { RepoRef } from "@/lib/domain/types";
import type { SelectionStore } from "@/lib/db/selection-store";
import type { GitHubClient } from "@/lib/github/client";
import { toGitHubError } from "@/lib/github/errors";
import { parseRepository } from "@/lib/github/parse";
import { parseSelection } from "@/lib/repos/selection";
import { mapWithConcurrency } from "@/lib/util/concurrency";

export interface SaveSelectionDeps {
  /** The authenticated user. Callers obtain this from the server-side session, never from input. */
  userId: string;
  client: Pick<GitHubClient, "request">;
  store: SelectionStore;
  cache: MemoryCache;
}

export type SaveSelectionResult =
  | { ok: true; count: number; repos: RepoRef[] }
  | { ok: false; error: string; inaccessible?: string[] };

/**
 * Validates and persists a repository selection.
 *
 * Authorization happens here, against GitHub itself: every submitted repository must be readable
 * with *this user's* token before anything is stored. A forged form field naming someone else's
 * private repository fails this check, because GitHub answers 404 for it.
 */
export async function saveSelection(
  deps: SaveSelectionDeps,
  raw: unknown,
): Promise<SaveSelectionResult> {
  const parsed = parseSelection(raw);
  if (!parsed.ok) return parsed;

  const checks = await mapWithConcurrency(parsed.repos, 4, async (repo) => {
    try {
      const response = await deps.client.request("GET /repos/{owner}/{repo}", {
        owner: repo.owner,
        repo: repo.name,
      });
      const canonical = parseRepository(response.data);
      return {
        requested: repo,
        canonical: { owner: canonical.owner, name: canonical.name },
        error: null,
      };
    } catch (error) {
      return { requested: repo, canonical: null, error: toGitHubError(error) };
    }
  });

  const inaccessible = checks.filter(
    (check) =>
      check.error && (check.error.kind === "not_found" || check.error.kind === "forbidden"),
  );
  if (inaccessible.length > 0) {
    const names = inaccessible.map((check) => `${check.requested.owner}/${check.requested.name}`);
    return {
      ok: false,
      error: `DevPulse can't read ${names.length === 1 ? "this repository" : "these repositories"} with your GitHub authorization: ${names.join(", ")}. For private repositories, enable private access first.`,
      inaccessible: names,
    };
  }

  const other = checks.find((check) => check.error);
  if (other?.error) {
    // Rate limits, network failures etc.: we could not verify access, so we must not save.
    return {
      ok: false,
      error: `Could not verify your repositories with GitHub. ${other.error.message}`,
    };
  }

  // Store GitHub's canonical spelling (case) of each name.
  const repos = checks.map((check) => check.canonical as RepoRef);
  await deps.store.replace(deps.userId, repos);
  // The data for the old selection is no longer wanted, and the new one must load fresh.
  deps.cache.invalidate(`${deps.userId}:`);
  return { ok: true, count: repos.length, repos };
}
