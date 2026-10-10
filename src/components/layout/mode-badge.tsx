import { FlaskConical } from "lucide-react";
import { getViewer } from "@/lib/auth/viewer";
import { StatusBadge } from "@/components/common/status-badge";

/** Always-visible indicator of which data the viewer is looking at. Streams in behind Suspense. */
export async function ModeBadge() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <StatusBadge tone="merged" icon={FlaskConical} className="h-6 px-2 text-xs">
      Demo mode · sample data
    </StatusBadge>
  );
}

export function ModeBadgeFallback() {
  return <div className="h-6 w-40 animate-pulse rounded-md bg-muted" aria-hidden />;
}
