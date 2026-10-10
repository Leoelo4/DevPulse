import { DataTable, TBody, Td, Th, THead } from "@/components/common/data-table";
import { ExternalLink } from "@/components/common/external-link";
import type { Contributor } from "@/lib/domain/types";
import { formatInteger, formatPercent } from "@/lib/format";

export function ContributorTable({ contributors }: { contributors: Contributor[] }) {
  const hasRecent = contributors.every((c) => c.commitsLast90Days !== null);
  const sorted = [...contributors].sort((a, b) =>
    hasRecent
      ? (b.commitsLast90Days ?? 0) - (a.commitsLast90Days ?? 0)
      : b.totalCommits - a.totalCommits,
  );
  const basisTotal = sorted.reduce(
    (sum, c) => sum + (hasRecent ? (c.commitsLast90Days ?? 0) : c.totalCommits),
    0,
  );

  return (
    <DataTable caption="Contributors ordered by commits" minWidth="min-w-[34rem]">
      <THead>
        <Th>Contributor</Th>
        {hasRecent ? <Th align="right">Commits · last 90 days</Th> : null}
        <Th align="right">Commits · all time</Th>
        <Th
          align="right"
          title={`Calculated: share of ${hasRecent ? "last-90-day" : "all-time"} commits. Commit counts are not a measure of effort or ownership.`}
        >
          Share of {hasRecent ? "recent" : "all-time"} commits
        </Th>
      </THead>
      <TBody>
        {sorted.map((contributor) => {
          const count = hasRecent ? (contributor.commitsLast90Days ?? 0) : contributor.totalCommits;
          return (
            <tr key={contributor.login} className="hover:bg-muted/30">
              <Td className="font-medium">
                <ExternalLink href={contributor.htmlUrl} showIcon={false}>
                  {contributor.login}
                </ExternalLink>
              </Td>
              {hasRecent ? (
                <Td align="right">{formatInteger(contributor.commitsLast90Days ?? 0)}</Td>
              ) : null}
              <Td align="right">{formatInteger(contributor.totalCommits)}</Td>
              <Td align="right">{basisTotal === 0 ? "—" : formatPercent(count / basisTotal)}</Td>
            </tr>
          );
        })}
      </TBody>
    </DataTable>
  );
}
