import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exitDemoMode } from "@/app/actions/mode";
import { PageHeader } from "@/components/common/page-header";
import { AccessCard } from "@/components/onboarding/access-card";
import { DisconnectButton } from "@/components/settings/disconnect-card";
import { RefreshSettings } from "@/components/settings/refresh-settings";
import { ThemeSetting } from "@/components/settings/theme-setting";
import { ThresholdsForm } from "@/components/settings/thresholds-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReconnectRequiredError } from "@/lib/auth/session";
import {
  BASE_TTL_MS,
  REFRESH_MODE_MULTIPLIER,
  type CachedResourceKind,
} from "@/lib/cache/freshness";
import { loadDashboard } from "@/lib/data/load";
import { formatDateTime } from "@/lib/format";
import { hasPrivateAccess } from "@/lib/live/accessible-repos";
import { createViewerClient } from "@/lib/live/live-source";
import { readRateLimit, type RateLimitStatus } from "@/lib/live/rate-limit";
import { getPreferences } from "@/lib/preferences.server";

export const metadata: Metadata = { title: "Settings" };

const FRESHNESS_ROWS: Array<[CachedResourceKind, string]> = [
  ["workflowRuns", "CI workflow runs"],
  ["pullRequests", "Pull requests and reviews"],
  ["issues", "Issues and replies"],
  ["releases", "Releases"],
  ["deployments", "Deployments"],
  ["commitActivity", "Commit and contributor statistics"],
];

function formatTtl(ms: number): string {
  const minutes = ms / 60_000;
  return minutes < 1 ? `${Math.round(ms / 1000)} s` : `${Math.round(minutes * 10) / 10} min`;
}

export default async function SettingsPage() {
  const { viewer, thresholds, snapshots } = await loadDashboard();
  const preferences = await getPreferences();

  let privateAccess = false;
  let rateLimit: RateLimitStatus | null = null;
  if (viewer.kind === "live") {
    try {
      const { client, scopes } = await createViewerClient(viewer.userId);
      privateAccess = hasPrivateAccess(scopes);
      rateLimit = await readRateLimit(client);
    } catch (error) {
      if (error instanceof ReconnectRequiredError) redirect("/?reconnect=1");
      throw error;
    }
  }

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
        <CardContent className="space-y-4">
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repositories selected yet.</p>
          ) : (
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
          )}
          {viewer.kind === "live" ? (
            <Button asChild variant="outline">
              <Link href="/onboarding">Change repositories</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {viewer.kind === "live" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Data refresh</CardTitle>
              <CardDescription>
                How long DevPulse keeps GitHub data in memory before checking again. Data is always
                labelled with when it was fetched.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <RefreshSettings current={preferences.refreshMode} />

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Current freshness rules</p>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {FRESHNESS_ROWS.map(([kind, label]) => (
                    <div key={kind} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="tabular-nums">
                        {formatTtl(
                          BASE_TTL_MS[kind] * REFRESH_MODE_MULTIPLIER[preferences.refreshMode],
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  The cache lives in this server process, so a restart or another server instance
                  starts empty. Failures are cached for only a minute.
                </p>
              </div>

              <div className="space-y-1 border-t pt-4">
                <p className="text-sm font-medium">GitHub API rate limit</p>
                {rateLimit ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="font-medium text-foreground tabular-nums">
                      {rateLimit.remaining.toLocaleString("en-US")}
                    </strong>{" "}
                    of {rateLimit.limit.toLocaleString("en-US")} requests remaining this hour;
                    resets {formatDateTime(rateLimit.resetAt.toISOString())}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The current quota could not be read from GitHub.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <AccessCard privateAccess={privateAccess} userName={viewer.name} />

          <Card>
            <CardHeader>
              <CardTitle>Disconnect</CardTitle>
              <CardDescription>
                Revoke DevPulse&apos;s access and delete everything it stores about you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DisconnectButton />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Data source</CardTitle>
            <CardDescription>
              Where the numbers on every page come from, and how fresh they are.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <FlaskConical className="mt-0.5 size-4 shrink-0 text-merged" aria-hidden />
              <span>
                You are in <strong className="font-medium">demo mode</strong>. Data is generated
                locally each time a page loads, so there is nothing to refresh and no GitHub account
                is connected.
              </span>
            </p>
            <form action={exitDemoMode}>
              <Button type="submit" variant="outline">
                Exit demo mode
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
