"use client";

import { RotateCcw } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  resetThresholds,
  saveThresholds,
  type ThresholdsFormState,
} from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { THRESHOLD_LIMITS, type MetricThresholds } from "@/lib/metrics/thresholds";

const FIELDS: {
  name: keyof MetricThresholds;
  label: string;
  help: string;
}[] = [
  {
    name: "stalePullRequestDays",
    label: "Stale pull request (days)",
    help: "An open pull request with no activity for this long is flagged as stale.",
  },
  {
    name: "staleIssueDays",
    label: "Stale issue (days)",
    help: "An open issue with no activity for this long is flagged as stale.",
  },
  {
    name: "releaseOverdueDays",
    label: "Release overdue (days)",
    help: "A repository with releases but none published for this long is flagged.",
  },
];

const INITIAL: ThresholdsFormState = { status: "idle" };

export function ThresholdsForm({ current }: { current: MetricThresholds }) {
  const [saveState, saveAction, saving] = useActionState(saveThresholds, INITIAL);
  const [resetState, resetAction, resetting] = useActionState(
    async (): Promise<ThresholdsFormState> => resetThresholds(),
    INITIAL,
  );

  useEffect(() => {
    if (saveState.status === "saved" && saveState.message) toast.success(saveState.message);
  }, [saveState]);
  useEffect(() => {
    if (resetState.status === "reset" && resetState.message) toast.success(resetState.message);
  }, [resetState]);

  const invalid = saveState.status === "error";

  return (
    // Re-keying on the stored values remounts the inputs after a save or reset, so they always
    // show what the server holds.
    <div key={JSON.stringify(current)} className="space-y-4">
      <form action={saveAction} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map(({ name, label, help }) => {
            const error = saveState.fieldErrors?.[name];
            const limits = THRESHOLD_LIMITS[name];
            return (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  name={name}
                  type="number"
                  inputMode="numeric"
                  min={limits.min}
                  max={limits.max}
                  step={1}
                  defaultValue={
                    invalid ? (saveState.values?.[name] ?? current[name]) : current[name]
                  }
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${name}-help${error ? ` ${name}-error` : ""}`}
                />
                <p id={`${name}-help`} className="text-xs leading-snug text-muted-foreground">
                  {help} ({limits.min}–{limits.max})
                </p>
                {error ? (
                  <p
                    id={`${name}-error`}
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {invalid && saveState.message ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {saveState.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save thresholds"}
          </Button>
        </div>
      </form>

      <form action={resetAction}>
        <Button type="submit" variant="ghost" size="sm" disabled={resetting}>
          <RotateCcw aria-hidden /> Reset to defaults
        </Button>
      </form>
    </div>
  );
}
