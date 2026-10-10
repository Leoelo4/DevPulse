import { FlaskConical } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { GithubMark } from "@/components/common/github-mark";
import { getViewer } from "@/lib/auth/viewer";
import { RefreshButton } from "./refresh-button";

/**
 * Always-visible indicator of which data the viewer is looking at, plus the manual-refresh control
 * for live data. Streams in behind Suspense.
 */
export async function ModeBadge() {
  const viewer = await getViewer();
  if (!viewer) return null;

  if (viewer.kind === "demo") {
    return (
      <StatusBadge tone="merged" icon={FlaskConical} className="h-6 px-2 text-xs">
        Demo mode · sample data
      </StatusBadge>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <RefreshButton />
      <StatusBadge tone="success" icon={GithubMark} className="h-6 px-2 text-xs">
        Live · {viewer.name}
      </StatusBadge>
    </div>
  );
}

export function ModeBadgeFallback() {
  return <div className="h-6 w-40 animate-pulse rounded-md bg-muted" aria-hidden />;
}
