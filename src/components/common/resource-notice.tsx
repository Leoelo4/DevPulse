import { AlertTriangle, Hourglass, Info, Lock, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Resource, UnavailableReason } from "@/lib/domain/types";

const REASON_TITLE: Record<UnavailableReason, string> = {
  forbidden: "Permission needed",
  unauthorized: "Sign-in expired",
  not_found: "Not found",
  rate_limited: "GitHub rate limit reached",
  disabled: "Not enabled for this repository",
  error: "Could not load from GitHub",
};

/**
 * Explains, in place, why a dataset is missing or incomplete. Renders nothing for complete data,
 * so pages can drop one under every section without visual noise.
 */
export function ResourceNotice({
  resource,
  label,
  children,
}: {
  resource: Resource<unknown>;
  /** Plural noun for the dataset, e.g. "Pull requests". */
  label: string;
  children?: ReactNode;
}) {
  if (resource.status === "ok") {
    if (resource.complete) return null;
    return (
      <p
        className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
        role="note"
      >
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{label} are a partial view.</span>{" "}
          {resource.note ??
            "GitHub returned more than DevPulse reads; older items are not included."}
        </span>
      </p>
    );
  }

  if (resource.status === "pending") {
    return (
      <Alert>
        <Hourglass aria-hidden />
        <AlertTitle>{label} are still being computed</AlertTitle>
        <AlertDescription>
          {resource.message} {children}
        </AlertDescription>
      </Alert>
    );
  }

  const Icon =
    resource.reason === "forbidden" || resource.reason === "unauthorized"
      ? Lock
      : resource.reason === "rate_limited"
        ? WifiOff
        : AlertTriangle;
  return (
    <Alert variant={resource.reason === "disabled" ? "default" : "destructive"}>
      <Icon aria-hidden />
      <AlertTitle>
        {label} unavailable — {REASON_TITLE[resource.reason]}
      </AlertTitle>
      <AlertDescription>
        {resource.message} {children}
      </AlertDescription>
    </Alert>
  );
}
