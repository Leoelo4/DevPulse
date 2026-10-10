import {
  CircleDot,
  CircleSlash,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Tag,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { ExternalLink } from "@/components/common/external-link";
import { RelativeTime } from "@/components/common/relative-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityEvent, ActivityKind } from "@/lib/domain/types";
import { Activity } from "lucide-react";

const KIND: Record<ActivityKind, { icon: LucideIcon; verb: string; className: string }> = {
  pull_request_opened: {
    icon: GitPullRequest,
    verb: "opened pull request",
    className: "text-success",
  },
  pull_request_merged: { icon: GitMerge, verb: "merged pull request", className: "text-merged" },
  pull_request_closed: {
    icon: GitPullRequestClosed,
    verb: "closed pull request",
    className: "text-danger",
  },
  issue_opened: { icon: CircleDot, verb: "opened issue", className: "text-success" },
  issue_closed: { icon: CircleSlash, verb: "closed issue", className: "text-merged" },
  workflow_failed: { icon: XCircle, verb: "workflow failed", className: "text-danger" },
  release_published: { icon: Tag, verb: "published release", className: "text-info" },
};

export function ActivityFeed({ events, now }: { events: ActivityEvent[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Newest events from the last 30 days across selected repositories, drawn from the pull
          requests, issues, workflow runs and releases DevPulse loaded. Not a complete event
          history.
        </p>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="Nothing happened in the last 30 days in the data DevPulse loaded."
            className="py-8"
          />
        ) : (
          <ol className="divide-y divide-border">
            {events.map((event) => {
              const { icon: Icon, verb, className } = KIND[event.kind];
              return (
                <li key={event.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="leading-snug">
                      {event.actor ? <span className="font-medium">{event.actor}</span> : null}{" "}
                      <span className="text-muted-foreground">{verb}</span>{" "}
                      <ExternalLink href={event.htmlUrl} className="font-medium" showIcon={false}>
                        {event.title}
                      </ExternalLink>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Link
                        href={`/repositories/${event.repoFullName}`}
                        className="underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {event.repoFullName}
                      </Link>{" "}
                      · <RelativeTime iso={event.at} now={now} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
