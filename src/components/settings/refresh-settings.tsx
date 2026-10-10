"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { refreshData } from "@/app/actions/live";
import { saveRefreshMode, type RefreshModeFormState } from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REFRESH_MODE_LABEL, REFRESH_MODES, type RefreshMode } from "@/lib/cache/freshness";

const INITIAL: RefreshModeFormState = { status: "idle" };

function RefreshNowButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
      {pending ? "Refreshing…" : "Refresh now"}
    </Button>
  );
}

export function RefreshSettings({ current }: { current: RefreshMode }) {
  const [state, action, saving] = useActionState(saveRefreshMode, INITIAL);

  useEffect(() => {
    if (state.status === "saved" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <RadioGroup
          name="refreshMode"
          defaultValue={current}
          aria-label="Data refresh mode"
          className="grid gap-3 sm:grid-cols-3"
        >
          {REFRESH_MODES.map((mode) => (
            <Label
              key={mode}
              htmlFor={`refresh-${mode}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem id={`refresh-${mode}`} value={mode} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{REFRESH_MODE_LABEL[mode].title}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {REFRESH_MODE_LABEL[mode].description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save refresh mode"}
        </Button>
      </form>

      <form action={refreshData} className="space-y-1.5 border-t pt-4">
        <p className="text-sm font-medium">Refresh now</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Clears DevPulse&apos;s in-memory copy of your data so the next page load asks GitHub
          again. Unchanged resources are revalidated with ETags, which GitHub does not count against
          your rate limit.
        </p>
        <RefreshNowButton />
      </form>
    </div>
  );
}
