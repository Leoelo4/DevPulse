import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { GithubMark } from "./github-mark";

export type ProvenanceKind = "github" | "calculated" | "mixed";

const COPY: Record<ProvenanceKind, { label: string; hint: string }> = {
  github: { label: "From GitHub", hint: "Value reported directly by the GitHub API." },
  calculated: {
    label: "Calculated",
    hint: "Derived by DevPulse from GitHub data; depends on the thresholds and the data window.",
  },
  mixed: {
    label: "Mixed",
    hint: "Combines values reported by GitHub with values calculated by DevPulse.",
  },
};

/** Small tag distinguishing values GitHub reports from values DevPulse derives. */
export function Provenance({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const { label, hint } = COPY[kind];
  const Icon = kind === "github" ? GithubMark : Calculator;
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] leading-none font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
