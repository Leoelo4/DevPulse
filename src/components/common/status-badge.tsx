import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  HelpCircle,
  Loader2,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  IndicatorStatus,
  PullRequest,
  ReviewState,
  WorkflowConclusion,
  WorkflowRun,
} from "@/lib/domain/types";
import type { HealthLevel } from "@/lib/metrics/health";
import type { CiStatus } from "@/lib/metrics/workflows";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "merged" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  merged: "border-merged/30 bg-merged/10 text-merged",
  neutral: "border-border bg-muted text-muted-foreground",
};

/**
 * The single place colour is applied to state. Colour never stands alone: every badge carries an
 * icon and a text label, so state is readable without colour perception.
 */
export function StatusBadge({
  tone,
  icon: Icon,
  children,
  className,
  spin = false,
}: {
  tone: Tone;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  spin?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 gap-1 rounded-md px-1.5 font-medium", TONE_CLASSES[tone], className)}
    >
      <Icon aria-hidden className={spin ? "animate-spin" : undefined} />
      {children}
    </Badge>
  );
}

export function CiStatusBadge({ status }: { status: CiStatus | "unknown" }) {
  switch (status) {
    case "passing":
      return (
        <StatusBadge tone="success" icon={CheckCircle2}>
          Passing
        </StatusBadge>
      );
    case "failing":
      return (
        <StatusBadge tone="danger" icon={XCircle}>
          Failing
        </StatusBadge>
      );
    case "running":
      return (
        <StatusBadge tone="info" icon={Loader2} spin>
          Running
        </StatusBadge>
      );
    case "no_runs":
      return (
        <StatusBadge tone="neutral" icon={CircleDashed}>
          No runs
        </StatusBadge>
      );
    case "unknown":
      return (
        <StatusBadge tone="neutral" icon={HelpCircle}>
          Unavailable
        </StatusBadge>
      );
  }
}

export function HealthBadge({ level }: { level: HealthLevel }) {
  switch (level) {
    case "healthy":
      return (
        <StatusBadge tone="success" icon={CheckCircle2}>
          No concerns
        </StatusBadge>
      );
    case "needs_attention":
      return (
        <StatusBadge tone="warning" icon={AlertTriangle}>
          Needs attention
        </StatusBadge>
      );
    case "at_risk":
      return (
        <StatusBadge tone="danger" icon={XCircle}>
          At risk
        </StatusBadge>
      );
    case "insufficient_data":
      return (
        <StatusBadge tone="neutral" icon={HelpCircle}>
          Not enough data
        </StatusBadge>
      );
  }
}

const INDICATOR: Record<IndicatorStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  good: { tone: "success", icon: CheckCircle2, label: "Good" },
  warning: { tone: "warning", icon: AlertTriangle, label: "Watch" },
  poor: { tone: "danger", icon: XCircle, label: "Poor" },
  unknown: { tone: "neutral", icon: HelpCircle, label: "Unknown" },
};

export function IndicatorBadge({ status }: { status: IndicatorStatus }) {
  const { tone, icon, label } = INDICATOR[status];
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  );
}

const REVIEW: Record<ReviewState, { tone: Tone; icon: LucideIcon; label: string }> = {
  approved: { tone: "success", icon: CheckCircle2, label: "Approved" },
  changes_requested: { tone: "danger", icon: XCircle, label: "Changes requested" },
  review_requested: { tone: "info", icon: Clock, label: "Review requested" },
  commented: { tone: "neutral", icon: CircleDot, label: "Commented" },
  no_reviews: { tone: "warning", icon: MinusCircle, label: "No reviews" },
};

export function ReviewBadge({ state }: { state: ReviewState | null }) {
  if (state === null) {
    return (
      <StatusBadge tone="neutral" icon={HelpCircle}>
        Not fetched
      </StatusBadge>
    );
  }
  const { tone, icon, label } = REVIEW[state];
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  );
}

export function PullRequestStateBadge({
  pr,
}: {
  pr: Pick<PullRequest, "state" | "merged" | "draft">;
}) {
  if (pr.merged) {
    return (
      <StatusBadge tone="merged" icon={GitMerge}>
        Merged
      </StatusBadge>
    );
  }
  if (pr.state === "closed") {
    return (
      <StatusBadge tone="danger" icon={GitPullRequestClosed}>
        Closed
      </StatusBadge>
    );
  }
  if (pr.draft) {
    return (
      <StatusBadge tone="neutral" icon={GitPullRequestDraft}>
        Draft
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="success" icon={GitPullRequest}>
      Open
    </StatusBadge>
  );
}

const CONCLUSION: Record<WorkflowConclusion, { tone: Tone; icon: LucideIcon; label: string }> = {
  success: { tone: "success", icon: CheckCircle2, label: "Success" },
  failure: { tone: "danger", icon: XCircle, label: "Failure" },
  timed_out: { tone: "danger", icon: Clock, label: "Timed out" },
  startup_failure: { tone: "danger", icon: XCircle, label: "Startup failure" },
  cancelled: { tone: "neutral", icon: MinusCircle, label: "Cancelled" },
  skipped: { tone: "neutral", icon: MinusCircle, label: "Skipped" },
  neutral: { tone: "neutral", icon: CircleDashed, label: "Neutral" },
  stale: { tone: "neutral", icon: Clock, label: "Stale" },
  action_required: { tone: "warning", icon: AlertTriangle, label: "Action required" },
};

export function RunStatusBadge({ run }: { run: Pick<WorkflowRun, "status" | "conclusion"> }) {
  if (run.status !== "completed" || run.conclusion === null) {
    const queued = run.status === "queued" || run.status === "pending" || run.status === "waiting";
    return (
      <StatusBadge tone="info" icon={queued ? Clock : Loader2} spin={!queued}>
        {queued ? "Queued" : "In progress"}
      </StatusBadge>
    );
  }
  const { tone, icon, label } = CONCLUSION[run.conclusion];
  return (
    <StatusBadge tone={tone} icon={icon}>
      {label}
    </StatusBadge>
  );
}
