import { Rocket, Zap } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentRelease } from "@/lib/metrics/overview";

export function RecentReleasesCard({ releases, now }: { releases: RecentRelease[]; now: Date }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Recent releases</CardTitle>
        <p className="text-xs text-muted-foreground">
          Published GitHub Releases only. Projects that ship via tags or package registries may show
          none.
        </p>
      </CardHeader>
      <CardContent>
        {releases.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No releases yet"
            description="No published releases were found."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {releases.map(({ repoFullName, release }) => (
              <li
                key={`${repoFullName}-${release.id}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <ExternalLink href={release.htmlUrl} showIcon={false}>
                      {release.name ?? release.tagName}
                    </ExternalLink>
                    {release.prerelease ? (
                      <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[10px]">
                        pre-release
                      </Badge>
                    ) : null}
                  </p>
                  <Link
                    href={`/repositories/${repoFullName}`}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {repoFullName}
                  </Link>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <RelativeTime iso={release.publishedAt} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentlyActiveCard({
  repos,
  now,
}: {
  repos: { repoFullName: string; lastActivityAt: string }[];
  now: Date;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Recently active repositories</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ordered by the time of the latest push to any branch.
        </p>
      </CardHeader>
      <CardContent>
        {repos.length === 0 ? (
          <EmptyState icon={Zap} title="No repositories" className="py-8" />
        ) : (
          <ul className="divide-y divide-border">
            {repos.map((repo) => (
              <li
                key={repo.repoFullName}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <Link
                  href={`/repositories/${repo.repoFullName}`}
                  className="min-w-0 truncate font-medium underline-offset-4 hover:text-primary hover:underline"
                >
                  {repo.repoFullName}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <RelativeTime iso={repo.lastActivityAt} now={now} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
