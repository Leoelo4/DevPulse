import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { exitDemoMode } from "@/app/actions/mode";
import { PageHeader } from "@/components/common/page-header";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { ThresholdsForm } from "@/components/settings/thresholds-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDashboard } from "@/lib/data/load";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, thresholds, snapshots } = await loadDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Appearance, the thresholds behind calculated metrics, tracked repositories and your data source."
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Dark is the default. Your choice is remembered in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metric thresholds</CardTitle>
          <CardDescription>
            These cut-offs decide what DevPulse calls &ldquo;stale&rdquo; or &ldquo;overdue&rdquo;.
            They are DevPulse settings, not GitHub values, and every metric that depends on one is
            labelled &ldquo;Calculated&rdquo;. Stored in a cookie in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdsForm current={thresholds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked repositories</CardTitle>
          <CardDescription>
            {viewer.kind === "demo"
              ? "Demo mode tracks a fixed set of generated sample repositories. Selecting your own repositories requires live mode."
              : "Repositories DevPulse loads data for."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.repository.fullName}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-medium">{snapshot.repository.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {snapshot.repository.primaryLanguage}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data source</CardTitle>
          <CardDescription>
            Where the numbers on every page come from, and how fresh they are.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {viewer.kind === "demo" ? (
            <>
              <p className="flex items-start gap-2 text-sm leading-relaxed">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-merged" aria-hidden />
                <span>
                  You are in <strong className="font-medium">demo mode</strong>. Data is generated
                  locally each time a page loads, so there is nothing to refresh and no GitHub
                  account is connected.
                </span>
              </p>
              <form action={exitDemoMode}>
                <Button type="submit" variant="outline">
                  Exit demo mode
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
