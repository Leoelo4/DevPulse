import { KeyRound } from "lucide-react";
import { connection } from "next/server";
import { GithubMark } from "@/components/common/github-mark";
import { Button } from "@/components/ui/button";
import { getLiveModeStatus } from "@/lib/env";

/**
 * Entry point for live mode. Environment is read at request time (not baked in at build time) so
 * the same build behaves correctly once credentials are provided.
 */
export async function LiveModeCard() {
  await connection();
  const status = getLiveModeStatus();

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <KeyRound className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Live mode — your repositories</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in with GitHub to analyse repositories you can access. Access tokens stay on the
              server and DevPulse only requests read access.
            </p>
          </div>

          {status.enabled ? (
            <Button disabled>
              <GithubMark aria-hidden /> Connect GitHub
            </Button>
          ) : (
            <div className="space-y-2">
              <Button disabled aria-describedby="live-mode-setup">
                <GithubMark aria-hidden /> Connect GitHub
              </Button>
              <p id="live-mode-setup" className="text-xs leading-relaxed text-muted-foreground">
                Live mode isn&apos;t configured on this deployment, so sign-in is switched off —
                demo mode needs no setup.
                {status.missing.length > 0 ? (
                  <>
                    {" "}
                    Missing:{" "}
                    {status.missing.map((name, i) => (
                      <span key={name}>
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{name}</code>
                        {i < status.missing.length - 1 ? ", " : ""}
                      </span>
                    ))}
                    .
                  </>
                ) : null}
                {status.invalid.length > 0 ? <> Invalid: {status.invalid.join("; ")}.</> : null} See{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  README.md → GitHub OAuth setup
                </code>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LiveModeCardFallback() {
  return <div className="h-40 animate-pulse rounded-xl border bg-card" aria-hidden />;
}
