import { Activity, GitPullRequest, Rocket, ShieldCheck, Users, FlaskConical } from "lucide-react";
import { Suspense } from "react";
import { enterDemoMode } from "@/app/actions/mode";
import { Brand } from "@/components/layout/brand";
import { LiveModeCard, LiveModeCardFallback } from "@/components/landing/live-mode-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Activity,
    title: "Activity & momentum",
    text: "Weekly commit trends and the most active repositories, straight from GitHub's statistics.",
  },
  {
    icon: GitPullRequest,
    title: "Pull request flow",
    text: "Throughput, age, time to merge, review status and stale pull requests.",
  },
  {
    icon: Rocket,
    title: "CI & releases",
    text: "Workflow outcomes over time, failure trends, release cadence and deployments.",
  },
  {
    icon: Users,
    title: "Contributors",
    text: "Who is committing, and how concentrated the work is across the team.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href="https://github.com/Leoelo4/DevPulse" target="_blank" rel="noopener noreferrer">
              Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16"
      >
        <section className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-primary">Open-source GitHub intelligence</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            See how your repositories are really doing.
          </h1>
          <p className="text-base leading-relaxed text-pretty text-muted-foreground">
            DevPulse turns GitHub activity into signals you can act on: pull request flow, CI
            reliability, release cadence and maintenance risks — and it tells you exactly what each
            number does and doesn&apos;t measure.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Choose how to start">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-merged/10 text-merged">
                <FlaskConical className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">Demo mode — no sign-in</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Explore the full interface with generated sample repositories. Nothing is
                    fetched from GitHub and every screen is labelled as sample data.
                  </p>
                </div>
                <form action={enterDemoMode}>
                  <Button type="submit">Explore the demo</Button>
                </form>
              </div>
            </div>
          </div>

          <Suspense fallback={<LiveModeCardFallback />}>
            <LiveModeCard />
          </Suspense>
        </section>

        <section className="mt-14" aria-labelledby="what-you-get">
          <h2 id="what-you-get" className="text-sm font-semibold">
            What you get
          </h2>
          <ul className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="mt-14 flex gap-3 rounded-xl border bg-muted/40 p-5"
          aria-labelledby="honesty"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div className="space-y-1">
            <h2 id="honesty" className="text-sm font-semibold">
              Honest about its limits
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              GitHub&apos;s API gives a partial, rate-limited view. Wherever a figure is truncated,
              sampled or unavailable, DevPulse says so next to the number, and separates values
              GitHub reports from values DevPulse calculates.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-xs text-muted-foreground sm:px-6">
        DevPulse is open source under the MIT license.
      </footer>
    </div>
  );
}
