import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Provenance } from "@/components/common/provenance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recommendation } from "@/lib/domain/types";

const SEVERITY: Record<
  Recommendation["severity"],
  { icon: LucideIcon; className: string; label: string }
> = {
  critical: { icon: AlertOctagon, className: "text-danger", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Warning" },
  info: { icon: Lightbulb, className: "text-info", label: "Suggestion" },
};

export function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">Maintenance recommendations</CardTitle>
          <Provenance kind="calculated" />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Generated from the indicators above. They are prompts to look closer, not verdicts.
        </p>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Nothing stands out in the data DevPulse loaded.
          </p>
        ) : (
          <ul className="space-y-3">
            {recommendations.map((rec) => {
              const { icon: Icon, className, label } = SEVERITY[rec.severity];
              return (
                <li key={rec.id} className="flex gap-2.5">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
                  <div className="min-w-0 text-sm">
                    <p className="leading-snug font-medium">
                      <span className="sr-only">{label}: </span>
                      {rec.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {rec.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
