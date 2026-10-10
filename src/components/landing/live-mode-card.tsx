import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { signInWithGitHub } from "@/app/actions/live";
import { GithubMark } from "@/components/common/github-mark";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { getLiveModeStatus } from "@/lib/env";

/**
 * Entry point for live mode. Environment and session are read at request time (not baked in at
 * build time) so the same build behaves correctly once credentials are provided.
 */
export async function LiveModeCard() {
  await connection();
  const status = getLiveModeStatus();
  const viewer = status.enabled ? await getViewer() : null;

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
              server, and DevPulse only reads data.
            </p>
          </div>

          {!status.enabled ? (
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
          ) : viewer?.kind === "live" ? (
            <div className="space-y-2">
              <p className="text-sm">
                Signed in as <strong className="font-medium">{viewer.name}</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/overview">Open your dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/onboarding">Choose repositories</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <form action={signInWithGitHub}>
                <Button type="submit">
                  <GithubMark aria-hidden /> Connect GitHub
                </Button>
              </form>
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                <span>
                  Starts with <strong className="font-medium">no scopes</strong>: public repository
                  data only. Private repositories are a separate opt-in you can enable later.
                </span>
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
