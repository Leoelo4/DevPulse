import { FlaskConical } from "lucide-react";
import { exitDemoMode } from "@/app/actions/mode";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";

/**
 * Persistent notice in demo mode. It is deliberately explicit that nothing on screen comes from
 * GitHub, so screenshots and screen-shares cannot be mistaken for real repository data.
 */
export async function DemoBanner() {
  const viewer = await getViewer();
  if (viewer?.kind !== "demo") return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-merged/30 bg-merged/10 px-3 py-2 text-sm"
    >
      <p className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-merged" aria-hidden />
        <span>
          <strong className="font-medium">You are exploring demo mode.</strong>{" "}
          <span className="text-muted-foreground">
            Every repository, person and number here is generated sample data — none of it comes
            from GitHub.
          </span>
        </span>
      </p>
      <form action={exitDemoMode}>
        <Button type="submit" variant="outline" size="sm">
          Exit demo
        </Button>
      </form>
    </div>
  );
}
