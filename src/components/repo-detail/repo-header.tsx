import { GitFork, Lock, Scale, Star, GitBranch } from "lucide-react";
import Link from "next/link";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { Badge } from "@/components/ui/badge";
import type { RepositorySnapshot } from "@/lib/domain/types";
import { formatCompact } from "@/lib/format";

export function RepoHeader({ snapshot, now }: { snapshot: RepositorySnapshot; now: Date }) {
  const { repository, meta } = snapshot;

  return (
    <header className="space-y-3">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link
          href="/repositories"
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          Repositories
        </Link>{" "}
        <span aria-hidden>/</span> <span className="text-foreground">{repository.fullName}</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="break-all">
              <span className="font-normal text-muted-foreground">{repository.owner}/</span>
              {repository.name}
            </span>
            {repository.isPrivate ? (
              <Badge variant="outline" className="h-5 gap-1 rounded-md px-1.5 text-[11px]">
                <Lock aria-hidden /> Private
              </Badge>
            ) : null}
            {repository.isArchived ? (
              <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[11px]">
                Archived
              </Badge>
            ) : null}
            {meta.mode === "demo" ? (
              <Badge
                variant="outline"
                className="h-5 rounded-md border-merged/30 bg-merged/10 px-1.5 text-[11px] text-merged"
              >
                Sample data
              </Badge>
            ) : null}
          </h1>
          {repository.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {repository.description}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-sm">
          {repository.htmlUrl ? (
            <ExternalLink
              href={repository.htmlUrl}
              className="rounded-md border px-3 py-1.5 font-medium hover:bg-muted"
            >
              View on GitHub
            </ExternalLink>
          ) : (
            <span
              className="inline-block rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground"
              title="Sample repositories do not exist on GitHub"
            >
              No GitHub page (sample data)
            </span>
          )}
        </div>
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {repository.primaryLanguage ? <li>{repository.primaryLanguage}</li> : null}
        <li className="inline-flex items-center gap-1">
          <Star className="size-3" aria-hidden /> {formatCompact(repository.stars)}
          <span className="sr-only"> stars</span>
        </li>
        <li className="inline-flex items-center gap-1">
          <GitFork className="size-3" aria-hidden /> {formatCompact(repository.forks)}
          <span className="sr-only"> forks</span>
        </li>
        <li className="inline-flex items-center gap-1">
          <GitBranch className="size-3" aria-hidden /> {repository.defaultBranch}
        </li>
        <li className="inline-flex items-center gap-1">
          <Scale className="size-3" aria-hidden /> {repository.license ?? "No license detected"}
        </li>
        <li>
          Last push <RelativeTime iso={repository.pushedAt ?? repository.updatedAt} now={now} />
        </li>
        {repository.topics.map((topic) => (
          <li key={topic}>
            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px] font-normal">
              {topic}
            </Badge>
          </li>
        ))}
      </ul>
    </header>
  );
}
