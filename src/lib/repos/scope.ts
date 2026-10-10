import type { RepositorySnapshot } from "@/lib/domain/types";

/**
 * Resolves the `?repo=owner/name` query to the snapshots a cross-repository page should cover.
 * Unknown values fall back to "all" so a stale link never produces an empty or broken page.
 */
export function scopeSnapshots(
  snapshots: readonly RepositorySnapshot[],
  rawRepo: string | string[] | undefined,
): { selected: RepositorySnapshot[]; repo: string | undefined } {
  const repo = Array.isArray(rawRepo) ? rawRepo[0] : rawRepo;
  const match = repo
    ? snapshots.find((snapshot) => snapshot.repository.fullName === repo)
    : undefined;
  return match
    ? { selected: [match], repo: match.repository.fullName }
    : { selected: [...snapshots], repo: undefined };
}
