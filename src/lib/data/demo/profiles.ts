/**
 * Behavioural profiles for the sample repositories. Each profile drives the deterministic
 * generator so the demo exercises healthy, struggling, and quiet repositories alike.
 *
 * Everything here is invented for demonstration. Names, handles, and counts do not refer to
 * real people, organisations, or projects.
 */
export interface DemoProfile {
  name: string;
  description: string;
  language: string;
  license: string | null;
  topics: string[];
  stars: number;
  forks: number;
  contributorCount: number;
  /** Share of commits by the most active contributor (0–1). */
  topContributorShare: number;
  commitsPerWeek: number;
  /** Commit-rate multiplier trending across the year: >1 growing, <1 declining. */
  commitTrend: number;
  prsPerWeek: number;
  medianMergeHours: number;
  /** Extra open pull requests that have been idle for weeks. */
  stalePullRequests: number;
  /** Probabilities for the review state of open, non-draft pull requests. */
  review: { approved: number; changesRequested: number; requested: number; commented: number };
  issuesPerWeek: number;
  medianResponseHours: number;
  /** Probability that a recent issue received a reply. */
  issueResponseRate: number;
  staleIssues: number;
  workflows: { name: string; failureRate: number; medianSeconds: number }[];
  runsPerDay: number;
  /** Force the latest default-branch CI run to this outcome. */
  latestMainRun: "success" | "failure";
  releaseEveryDays: number | null;
  lastReleaseDaysAgo: number;
  deploys: boolean;
  archived?: boolean;
}

export const DEMO_OWNER = "sample-org";

export const DEMO_PROFILES: readonly DemoProfile[] = [
  {
    name: "pulse-api",
    description: "Sample REST API service. Demonstrates a busy, well-maintained repository.",
    language: "TypeScript",
    license: "MIT",
    topics: ["api", "typescript", "sample"],
    stars: 214,
    forks: 31,
    contributorCount: 9,
    topContributorShare: 0.34,
    commitsPerWeek: 26,
    commitTrend: 1.2,
    prsPerWeek: 9,
    medianMergeHours: 14,
    stalePullRequests: 1,
    review: { approved: 0.4, changesRequested: 0.15, requested: 0.3, commented: 0.15 },
    issuesPerWeek: 4,
    medianResponseHours: 6,
    issueResponseRate: 0.92,
    staleIssues: 2,
    workflows: [
      { name: "CI", failureRate: 0.08, medianSeconds: 410 },
      { name: "Lint", failureRate: 0.05, medianSeconds: 95 },
      { name: "Deploy", failureRate: 0.03, medianSeconds: 260 },
    ],
    runsPerDay: 5,
    latestMainRun: "success",
    releaseEveryDays: 12,
    lastReleaseDaysAgo: 5,
    deploys: true,
  },
  {
    name: "pulse-web",
    description: "Sample web client. CI has been unstable recently.",
    language: "TypeScript",
    license: "MIT",
    topics: ["react", "frontend", "sample"],
    stars: 158,
    forks: 22,
    contributorCount: 7,
    topContributorShare: 0.46,
    commitsPerWeek: 18,
    commitTrend: 1,
    prsPerWeek: 7,
    medianMergeHours: 30,
    stalePullRequests: 3,
    review: { approved: 0.25, changesRequested: 0.2, requested: 0.35, commented: 0.2 },
    issuesPerWeek: 5,
    medianResponseHours: 20,
    issueResponseRate: 0.78,
    staleIssues: 6,
    workflows: [
      { name: "CI", failureRate: 0.34, medianSeconds: 640 },
      { name: "E2E", failureRate: 0.42, medianSeconds: 980 },
    ],
    runsPerDay: 4,
    latestMainRun: "failure",
    releaseEveryDays: 21,
    lastReleaseDaysAgo: 16,
    deploys: true,
  },
  {
    name: "docs-site",
    description: "Sample documentation site. Steady, low-risk maintenance.",
    language: "MDX",
    license: "CC-BY-4.0",
    topics: ["documentation", "sample"],
    stars: 47,
    forks: 12,
    contributorCount: 5,
    topContributorShare: 0.52,
    commitsPerWeek: 7,
    commitTrend: 1,
    prsPerWeek: 3,
    medianMergeHours: 9,
    stalePullRequests: 0,
    review: { approved: 0.5, changesRequested: 0.05, requested: 0.3, commented: 0.15 },
    issuesPerWeek: 1.5,
    medianResponseHours: 30,
    issueResponseRate: 0.85,
    staleIssues: 1,
    workflows: [{ name: "Build docs", failureRate: 0.06, medianSeconds: 180 }],
    runsPerDay: 2,
    latestMainRun: "success",
    releaseEveryDays: null,
    lastReleaseDaysAgo: 0,
    deploys: false,
  },
  {
    name: "infra-config",
    description: "Sample infrastructure-as-code repository. Reviews are the bottleneck.",
    language: "HCL",
    license: null,
    topics: ["terraform", "infrastructure", "sample"],
    stars: 19,
    forks: 4,
    contributorCount: 3,
    topContributorShare: 0.88,
    commitsPerWeek: 3,
    commitTrend: 0.5,
    prsPerWeek: 1.5,
    medianMergeHours: 110,
    stalePullRequests: 5,
    review: { approved: 0.1, changesRequested: 0.1, requested: 0.2, commented: 0.1 },
    issuesPerWeek: 0.6,
    medianResponseHours: 120,
    issueResponseRate: 0.45,
    staleIssues: 7,
    workflows: [{ name: "Plan", failureRate: 0.12, medianSeconds: 300 }],
    runsPerDay: 1,
    latestMainRun: "success",
    releaseEveryDays: 45,
    lastReleaseDaysAgo: 140,
    deploys: true,
  },
  {
    name: "cli-tools",
    description: "Sample command-line toolkit with a regular release cadence.",
    language: "Go",
    license: "Apache-2.0",
    topics: ["cli", "golang", "sample"],
    stars: 93,
    forks: 14,
    contributorCount: 6,
    topContributorShare: 0.41,
    commitsPerWeek: 11,
    commitTrend: 1.05,
    prsPerWeek: 4,
    medianMergeHours: 22,
    stalePullRequests: 1,
    review: { approved: 0.45, changesRequested: 0.1, requested: 0.3, commented: 0.15 },
    issuesPerWeek: 2,
    medianResponseHours: 12,
    issueResponseRate: 0.88,
    staleIssues: 3,
    workflows: [
      { name: "Test", failureRate: 0.07, medianSeconds: 220 },
      { name: "Release", failureRate: 0.04, medianSeconds: 540 },
    ],
    runsPerDay: 2.5,
    latestMainRun: "success",
    releaseEveryDays: 14,
    lastReleaseDaysAgo: 9,
    deploys: false,
  },
  {
    name: "data-pipeline",
    description: "Sample batch-processing pipeline. Growing issue backlog and flaky tests.",
    language: "Python",
    license: "MIT",
    topics: ["etl", "python", "sample"],
    stars: 61,
    forks: 9,
    contributorCount: 4,
    topContributorShare: 0.7,
    commitsPerWeek: 6,
    commitTrend: 0.7,
    prsPerWeek: 2,
    medianMergeHours: 70,
    stalePullRequests: 4,
    review: { approved: 0.2, changesRequested: 0.15, requested: 0.3, commented: 0.2 },
    issuesPerWeek: 3.5,
    medianResponseHours: 95,
    issueResponseRate: 0.5,
    staleIssues: 12,
    workflows: [
      { name: "Unit tests", failureRate: 0.22, medianSeconds: 340 },
      { name: "Integration tests", failureRate: 0.31, medianSeconds: 870 },
    ],
    runsPerDay: 2,
    latestMainRun: "failure",
    releaseEveryDays: 60,
    lastReleaseDaysAgo: 75,
    deploys: false,
  },
];
