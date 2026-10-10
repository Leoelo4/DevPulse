import { ChevronRight } from "lucide-react";
import { HealthBadge, IndicatorBadge } from "@/components/common/status-badge";
import { Provenance } from "@/components/common/provenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthIndicator } from "@/lib/domain/types";
import { summarizeHealth } from "@/lib/metrics/health";

export function HealthIndicators({ indicators }: { indicators: HealthIndicator[] }) {
  const summary = summarizeHealth(indicators);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm">Maintenance indicators</CardTitle>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Six calculated signals. Expand any row to see exactly what it measures and what it
              cannot tell you. A green indicator means &ldquo;no concern found in this data&rdquo;,
              not &ldquo;healthy&rdquo;.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge level={summary.level} />
            <Provenance kind="calculated" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {indicators.map((indicator) => (
            <li key={indicator.id}>
              <details className="group py-2.5">
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-md [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{indicator.label}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{indicator.value}</p>
                  </div>
                  <IndicatorBadge status={indicator.status} />
                </summary>
                <dl className="mt-2 ml-6.5 space-y-2 text-xs leading-relaxed">
                  <div>
                    <dt className="font-medium">What this measures</dt>
                    <dd className="text-muted-foreground">{indicator.measures}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">What it does not tell you</dt>
                    <dd className="text-muted-foreground">{indicator.limitation}</dd>
                  </div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
