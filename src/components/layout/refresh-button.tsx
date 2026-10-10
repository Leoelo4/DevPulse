"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";
import { refreshData } from "@/app/actions/live";
import { Button } from "@/components/ui/button";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label="Refresh data from GitHub"
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
      <span className="hidden sm:inline">{pending ? "Refreshing…" : "Refresh"}</span>
    </Button>
  );
}

/** Manual refresh for live data: clears this user's cache so the next render re-checks GitHub. */
export function RefreshButton() {
  return (
    <form action={refreshData}>
      <Submit />
    </form>
  );
}
