import { Rocket, Tag } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/page-header";
import { RelativeTime } from "@/components/common/relative-time";
import { StatTile } from "@/components/common/stat-tile";
import { DeploymentTable, ReleaseTable, type ReleaseRow } from "@/components/tables/release-tables";
import { Badge } from "@/components/ui/badge";
import type { Deployment, Tag as GitTag } from "@/lib/domain/types";
import { formatDays } from "@/lib/format";
import { summarizeReleases } from "@/lib/metrics/releases";

export function ReleaseInsights({
  rows,
  now,
  tags,
  deployments,
  deploymentsNote,
}: {
  rows: ReleaseRow[];
  now: Date;
  tags?: GitTag[];
  deployments?: Deployment[];
  /** Shown instead of the deployments table when deployments are unavailable for the repository. */
  deploymentsNote?: string;
}) {
  const summary = summarizeReleases(
    rows.map((row) => row.release),
    now,
  );

  return (
    <div className="space-y-6">
      <section aria-label="Release metrics" className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Latest release"
          value={
            summary.latest ? (
              <span className="text-2xl">{summary.latest.name ?? summary.latest.tagName}</span>
            ) : (
              "—"
            )
          }
          caption={
            summary.latest ? (
              <RelativeTime iso={summary.latest.publishedAt} now={now} />
            ) : (
              "No published releases"
            )
          }
          provenance="github"
          definition={<p>The newest published, non-draft GitHub Release.</p>}
        />
        <StatTile
          label="Days since latest release"
          value={summary.daysSinceLatest === null ? "—" : summary.daysSinceLatest}
          caption="Published GitHub Releases only"
          provenance="calculated"
          definition={
            <p>
              Whole days between the latest published release and now. Projects that ship through
              tags or package registries without GitHub Releases show no value.
            </p>
          }
        />
        <StatTile
          label="Typical gap between releases"
          value={formatDays(summary.medianDaysBetween)}
          caption={
            summary.medianDaysBetween === null
              ? "Needs at least two releases"
              : "Median across loaded releases"
          }
          provenance="calculated"
          definition={<p>Median number of days between consecutive published releases.</p>}
        />
      </section>

      <Section title="Release history" description="Published GitHub Releases, newest first.">
        <ReleaseTable
          rows={[...rows].sort(
            (a, b) =>
              Date.parse(b.release.publishedAt ?? "1970-01-01") -
              Date.parse(a.release.publishedAt ?? "1970-01-01"),
          )}
          now={now}
          caption="Release history"
        />
      </Section>

      {tags ? (
        <Section
          title="Tags"
          description="Git tags, which GitHub lists without dates. Not every tag has a release."
        >
          {tags.length === 0 ? (
            <EmptyState icon={Tag} title="No tags" className="py-8" />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.name}>
                  <Badge
                    variant="outline"
                    className="h-6 gap-1.5 rounded-md px-2 font-mono text-xs"
                  >
                    {tag.name}
                    <span className="text-muted-foreground">{tag.sha}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {deployments || deploymentsNote ? (
        <Section
          title="Deployments"
          description="Recorded through the GitHub Deployments API, where the repository uses it."
        >
          {deployments && deployments.length > 0 ? (
            <DeploymentTable deployments={deployments} now={now} />
          ) : (
            <EmptyState
              icon={Rocket}
              title="No deployment data"
              description={deploymentsNote ?? "No deployments were recorded for this repository."}
              className="py-8"
            />
          )}
        </Section>
      ) : null}
    </div>
  );
}
