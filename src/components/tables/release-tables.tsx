import { Rocket } from "lucide-react";
import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Deployment, DeploymentState, Release } from "@/lib/domain/types";
import { CheckCircle2, CircleDashed, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/common/status-badge";

export interface ReleaseRow {
  release: Release;
  repoFullName?: string;
}

export function ReleaseTable({
  rows,
  now,
  caption,
}: {
  rows: ReleaseRow[];
  now: Date;
  caption: string;
}) {
  const showRepo = rows.some((row) => row.repoFullName);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Rocket}
        title="No published releases"
        description="Only GitHub Releases are listed. Projects that publish through tags or package registries will not appear here."
        className="py-8"
      />
    );
  }

  return (
    <DataTable caption={caption} minWidth="min-w-[36rem]">
      <THead>
        <Th>Release</Th>
        {showRepo ? <Th>Repository</Th> : null}
        <Th>Published</Th>
        <Th>Author</Th>
      </THead>
      <TBody>
        {rows.map(({ release, repoFullName }) => (
          <tr key={`${repoFullName ?? ""}-${release.id}`} className="hover:bg-muted/30">
            <Td>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <ExternalLink href={release.htmlUrl} showIcon={false}>
                  {release.name ?? release.tagName}
                </ExternalLink>
                {release.name && release.name !== release.tagName ? (
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {release.tagName}
                  </span>
                ) : null}
                {release.prerelease ? (
                  <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[10px]">
                    pre-release
                  </Badge>
                ) : null}
                {release.draft ? (
                  <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[10px]">
                    draft
                  </Badge>
                ) : null}
              </p>
            </Td>
            {showRepo ? <Td className="text-muted-foreground">{repoFullName}</Td> : null}
            <Td className="whitespace-nowrap text-muted-foreground">
              <RelativeTime iso={release.publishedAt} now={now} />
            </Td>
            <Td className="text-muted-foreground">{release.author ?? "—"}</Td>
          </tr>
        ))}
      </TBody>
    </DataTable>
  );
}

const DEPLOYMENT: Record<DeploymentState, { tone: Tone; icon: LucideIcon; label: string }> = {
  success: { tone: "success", icon: CheckCircle2, label: "Success" },
  failure: { tone: "danger", icon: XCircle, label: "Failure" },
  error: { tone: "danger", icon: XCircle, label: "Error" },
  in_progress: { tone: "info", icon: Clock, label: "In progress" },
  queued: { tone: "info", icon: Clock, label: "Queued" },
  pending: { tone: "info", icon: Clock, label: "Pending" },
  inactive: { tone: "neutral", icon: CircleDashed, label: "Inactive" },
  unknown: { tone: "neutral", icon: CircleDashed, label: "Unknown" },
};

export function DeploymentTable({ deployments, now }: { deployments: Deployment[]; now: Date }) {
  return (
    <DataTable caption="Recent deployments" minWidth="min-w-[30rem]">
      <THead>
        <Th>Environment</Th>
        <Th>Status</Th>
        <Th>Ref</Th>
        <Th>Created</Th>
      </THead>
      <TBody>
        {deployments.map((deployment) => {
          const { tone, icon, label } = DEPLOYMENT[deployment.state];
          return (
            <tr key={deployment.id} className="hover:bg-muted/30">
              <Td className="font-medium">{deployment.environment}</Td>
              <Td>
                <StatusBadge tone={tone} icon={icon}>
                  {label}
                </StatusBadge>
              </Td>
              <Td className="font-mono text-xs text-muted-foreground">{deployment.ref}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                <RelativeTime iso={deployment.createdAt} now={now} />
              </Td>
            </tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
