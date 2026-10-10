"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Boundary for unexpected render failures inside the app. Expected problems (missing permission,
 * rate limits, unavailable datasets) are handled in place by `ResourceNotice` and never get here.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This page failed to render. Your data is unaffected. You can try again, and if the problem
          persists please open an issue
          {error.digest ? (
            <>
              {" "}
              and include the reference{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{error.digest}</code>
            </>
          ) : null}
          .
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw aria-hidden /> Try again
      </Button>
    </div>
  );
}
