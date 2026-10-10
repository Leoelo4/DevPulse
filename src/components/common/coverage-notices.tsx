import type { Resource, RepositorySnapshot } from "@/lib/domain/types";
import { ResourceNotice } from "./resource-notice";

/**
 * On cross-repository pages, surfaces every repository whose dataset is missing or truncated so
 * totals are never silently under-reported. Renders nothing when all datasets are complete.
 */
export function CoverageNotices({
  snapshots,
  pick,
  label,
}: {
  snapshots: readonly RepositorySnapshot[];
  pick: (snapshot: RepositorySnapshot) => Resource<unknown>;
  /** Plural noun, e.g. "Pull requests". */
  label: string;
}) {
  const problems = snapshots.filter((snapshot) => {
    const resource = pick(snapshot);
    return resource.status !== "ok" || !resource.complete;
  });
  if (problems.length === 0) return null;

  return (
    <div className="space-y-2" aria-label={`${label} data coverage`}>
      {problems.map((snapshot) => (
        <ResourceNotice
          key={snapshot.repository.fullName}
          resource={pick(snapshot)}
          label={`${label} for ${snapshot.repository.fullName}`}
        />
      ))}
    </div>
  );
}
