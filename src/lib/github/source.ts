import { ttlForResource, type CachedResourceKind, type RefreshMode } from "@/lib/cache/freshness";
import type { MemoryCache } from "@/lib/cache/memory-cache";
import type { DashboardDataSource } from "@/lib/data/source";
import type {
  Deployment,
  Issue,
  PullRequest,
  RepoRef,
  Repository,
  RepositorySnapshot,
  Resource,
} from "@/lib/domain/types";
import { MS_PER_DAY } from "@/lib/metrics/util";
import { mapWithConcurrency } from "@/lib/util/concurrency";
import type { GitHubClient } from "./client";
import { deriveFirstResponses, deriveReviewState } from "./derive";
import { toGitHubError, unavailable } from "./errors";
import { fetchPaginated } from "./paginate";
import {
  parseCommitActivity,
  parseContributorList,
  parseContributorStats,
  parseDeployments,
  parseIssueComments,
  parseIssues,
  parseLatestDeploymentState,
  parsePullRequests,
  parseReleases,
  parseRepository,
  parseReviews,
  parseTags,
  parseWorkflowRuns,
  toDeployment,
} from "./parse";

/** Per-dataset read limits. Every cap is surfaced to the viewer when it truncates a dataset. */
export const LIMITS = {
  pullRequestPages: 3,
  issuePages: 3,
  issueCommentPages: 5,
  workflowRunPages: 3,
  releasesPerPage: 30,
  tagsPerPage: 30,
  deployments: 8,
  /** Reviews are fetched per pull request, so only this many of the newest open PRs get them. */
  reviewBudget: 25,
  reviewConcurrency: 5,
  repositoryConcurrency: 3,
  /** Window for issue first-response times and for workflow runs, in days. */
  recentWindowDays: 30,
} as const;

export interface GitHubSourceOptions {
  client: GitHubClient;
  /** Namespaces cache keys so one user's data is never served to another. */
  userId: string;
  /** The repositories this viewer chose to track. Nothing else can be loaded. */
  selection: readonly RepoRef[];
  cache: MemoryCache;
  refreshMode: RefreshMode;
  now?: Date;
  /** How long to wait before re-asking for statistics GitHub is still computing (202). */
  statsRetryDelayMs?: number;
}

type Loaded<T> = { resource: Resource<T>; fetchedAt: number };

const sameRepo = (a: RepoRef, owner: string, name: string) =>
  a.owner.toLowerCase() === owner.toLowerCase() && a.name.toLowerCase() === name.toLowerCase();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class GitHubDataSource implements DashboardDataSource {
  readonly mode = "live" as const;
  private readonly now: Date;

  constructor(private readonly options: GitHubSourceOptions) {
    this.now = options.now ?? new Date();
  }

  async getSnapshots(): Promise<RepositorySnapshot[]> {
    return mapWithConcurrency(this.options.selection, LIMITS.repositoryConcurrency, (ref) =>
      this.loadSnapshot(ref),
    );
  }

  async getSnapshot(owner: string, name: string): Promise<RepositorySnapshot | null> {
    // Authorization boundary: only repositories the viewer selected can be loaded, regardless of
    // what the URL asks for.
    const ref = this.options.selection.find((candidate) => sameRepo(candidate, owner, name));
    return ref ? this.loadSnapshot(ref) : null;
  }

  /* ------------------------------------------------------------------ */

  private async loadSnapshot(ref: RepoRef): Promise<RepositorySnapshot> {
    const repoKey = `${ref.owner}/${ref.name}`.toLowerCase();
    const metadata = await this.cached<Repository>(repoKey, "repository", "", () =>
      this.fetchRepository(ref),
    );

    if (metadata.resource.status !== "ok") {
      // The repository itself is unreadable: report that once rather than failing nine more requests.
      const { reason, message } =
        metadata.resource.status === "unavailable"
          ? metadata.resource
          : { reason: "error" as const, message: "Repository metadata is not ready." };
      const blocked = <T>(): Resource<T> => ({ status: "unavailable", reason, message });
      return {
        repository: placeholderRepository(ref),
        pullRequests: blocked(),
        issues: blocked(),
        workflowRuns: blocked(),
        releases: blocked(),
        tags: blocked(),
        deployments: blocked(),
        contributors: blocked(),
        commitActivity: blocked(),
        meta: {
          mode: "live",
          fetchedAt: new Date(metadata.fetchedAt).toISOString(),
          caveats: [],
          access: { status: "unavailable", reason, message },
        },
      };
    }

    const repository = metadata.resource.data;
    const route = { owner: ref.owner, repo: ref.name };

    const [pulls, issues, runs, releases, tags, deployments, contributors, commitActivity] =
      await Promise.all([
        this.cached(repoKey, "pullRequests", "", () => this.fetchPullRequests(route, repoKey)),
        this.cached(repoKey, "issues", "", () => this.fetchIssues(route)),
        this.cached(repoKey, "workflowRuns", "", () => this.fetchWorkflowRuns(route)),
        this.cached(repoKey, "releases", "", () => this.fetchReleases(route)),
        this.cached(repoKey, "tags", "", () => this.fetchTags(route)),
        this.cached(repoKey, "deployments", "", () => this.fetchDeployments(route)),
        this.cached(repoKey, "contributors", "", () => this.fetchContributors(route)),
        this.cached(repoKey, "commitActivity", "", () => this.fetchCommitActivity(route)),
      ]);

    const loaded = [
      metadata,
      pulls,
      issues,
      runs,
      releases,
      tags,
      deployments,
      contributors,
      commitActivity,
    ];
    return {
      repository,
      pullRequests: pulls.resource,
      issues: issues.resource,
      workflowRuns: runs.resource,
      releases: releases.resource,
      tags: tags.resource,
      deployments: deployments.resource,
      contributors: contributors.resource,
      commitActivity: commitActivity.resource,
      meta: {
        mode: "live",
        // The snapshot is only as fresh as its oldest part.
        fetchedAt: new Date(Math.min(...loaded.map((l) => l.fetchedAt))).toISOString(),
        caveats: [],
        access: { status: "ok" },
      },
    };
  }

  /** Cache-through load. Errors become `unavailable` resources (and are cached briefly). */
  private async cached<T>(
    repoKey: string,
    kind: CachedResourceKind,
    suffix: string,
    loader: () => Promise<Resource<T>>,
  ): Promise<Loaded<T>> {
    const key = `${this.options.userId}:${repoKey}:${kind}${suffix}`;
    const result = await this.options.cache.getOrLoad<Resource<T>>(
      key,
      (value) => ttlForResource(kind, this.options.refreshMode, value),
      async () => {
        try {
          return await loader();
        } catch (error) {
          return unavailable(error);
        }
      },
    );
    return { resource: result.value, fetchedAt: result.fetchedAt };
  }

  /* ------------------------------ fetchers ------------------------------ */

  private async fetchRepository(route: RepoRef): Promise<Resource<Repository>> {
    const response = await this.options.client.request("GET /repos/{owner}/{repo}", {
      owner: route.owner,
      repo: route.name,
    });
    return { status: "ok", data: parseRepository(response.data), complete: true };
  }

  private async fetchPullRequests(
    route: { owner: string; repo: string },
    repoKey: string,
  ): Promise<Resource<PullRequest[]>> {
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/pulls",
      { ...route, state: "all", sort: "updated", direction: "desc" },
      { maxPages: LIMITS.pullRequestPages },
    );
    const { items, skipped } = parsePullRequests(page.items);
    const withReviews = await this.attachReviews(route, repoKey, items);

    const notes: string[] = [];
    if (!page.complete)
      notes.push(`Only the ${items.length} most recently updated pull requests were loaded.`);
    if (skipped > 0)
      notes.push(`${skipped} records were skipped because GitHub returned an unexpected shape.`);
    return {
      status: "ok",
      data: withReviews,
      complete: page.complete && skipped === 0,
      ...(notes.length > 0 ? { note: notes.join(" ") } : {}),
    };
  }

  /** Fetches review history for the most recently updated open, non-draft pull requests. */
  private async attachReviews(
    route: { owner: string; repo: string },
    repoKey: string,
    pullRequests: PullRequest[],
  ): Promise<PullRequest[]> {
    const candidates = pullRequests
      .filter((pr) => pr.state === "open" && !pr.draft)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, LIMITS.reviewBudget);

    const states = new Map<number, PullRequest["reviewState"]>();
    let stop = false;

    await mapWithConcurrency(candidates, LIMITS.reviewConcurrency, async (pr) => {
      if (stop) return;
      const result = await this.cached<PullRequest["reviewState"]>(
        repoKey,
        "reviews",
        `:${pr.number}:${pr.updatedAt}`, // a changed pull request gets a new key
        async () => {
          const page = await fetchPaginated(
            this.options.client,
            "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            { ...route, pull_number: pr.number },
            { maxPages: 1 },
          );
          const { items } = parseReviews(page.items);
          return {
            status: "ok",
            data: deriveReviewState(items, pr.requestedReviewerCount),
            complete: true,
          };
        },
      );
      if (result.resource.status === "ok") states.set(pr.number, result.resource.data);
      // Out of quota: stop spending requests; remaining pull requests stay "not fetched".
      else if (
        result.resource.status === "unavailable" &&
        result.resource.reason === "rate_limited"
      )
        stop = true;
    });

    return pullRequests.map((pr) =>
      states.has(pr.number) ? { ...pr, reviewState: states.get(pr.number) ?? null } : pr,
    );
  }

  private async fetchIssues(route: { owner: string; repo: string }): Promise<Resource<Issue[]>> {
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/issues",
      { ...route, state: "all", sort: "updated", direction: "desc" },
      { maxPages: LIMITS.issuePages },
    );
    const { items: issues, skipped } = parseIssues(page.items);

    const windowStart = new Date(this.now.getTime() - LIMITS.recentWindowDays * MS_PER_DAY);
    let withResponses = issues;
    let responseNote = "";
    let responsesPartial = false;
    try {
      const comments = await fetchPaginated(
        this.options.client,
        "GET /repos/{owner}/{repo}/issues/comments",
        { ...route, since: windowStart.toISOString(), sort: "created", direction: "asc" },
        { maxPages: LIMITS.issueCommentPages },
      );
      withResponses = deriveFirstResponses(issues, parseIssueComments(comments.items).items, {
        windowStart,
        commentsComplete: comments.complete,
      });
      if (!comments.complete) {
        responsesPartial = true;
        responseNote =
          " Reply times are partial: the comment history for the last 30 days was too long to read in full.";
      }
    } catch (error) {
      // Issues are still useful without response times; say why they are missing.
      responsesPartial = true;
      responseNote = ` Reply times are unavailable: ${toGitHubError(error).message}`;
    }

    const notes: string[] = [];
    if (!page.complete)
      notes.push(`Only the ${issues.length} most recently updated issues were loaded.`);
    if (skipped > 0)
      notes.push(`${skipped} records were skipped because GitHub returned an unexpected shape.`);
    notes.push(
      `Reply times are only measured for issues opened in the last ${LIMITS.recentWindowDays} days.${responseNote}`,
    );
    return {
      status: "ok",
      data: withResponses,
      complete: page.complete && skipped === 0 && !responsesPartial,
      note: notes.join(" "),
    };
  }

  private async fetchWorkflowRuns(route: { owner: string; repo: string }) {
    const since = new Date(this.now.getTime() - LIMITS.recentWindowDays * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/actions/runs",
      { ...route, created: `>=${since}` },
      { maxPages: LIMITS.workflowRunPages },
    );
    const { items, skipped } = parseWorkflowRuns(page.items);
    return {
      status: "ok" as const,
      data: items,
      complete: page.complete && skipped === 0,
      note: `Workflow runs from the last ${LIMITS.recentWindowDays} days${page.complete ? "" : `; only the ${items.length} most recent were loaded`}.`,
    };
  }

  private async fetchReleases(route: { owner: string; repo: string }) {
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/releases",
      { ...route, per_page: LIMITS.releasesPerPage },
      { maxPages: 1 },
    );
    const { items, skipped } = parseReleases(page.items);
    return {
      status: "ok" as const,
      data: items,
      complete: page.complete && skipped === 0,
      note: `Only the ${LIMITS.releasesPerPage} most recent releases are loaded.`,
    };
  }

  private async fetchTags(route: { owner: string; repo: string }) {
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/tags",
      { ...route, per_page: LIMITS.tagsPerPage },
      { maxPages: 1 },
    );
    const { items, skipped } = parseTags(page.items);
    return {
      status: "ok" as const,
      data: items,
      complete: page.complete && skipped === 0,
      note: `Only the ${LIMITS.tagsPerPage} most recent tags are loaded.`,
    };
  }

  private async fetchDeployments(route: {
    owner: string;
    repo: string;
  }): Promise<Resource<Deployment[]>> {
    const page = await fetchPaginated(
      this.options.client,
      "GET /repos/{owner}/{repo}/deployments",
      { ...route, per_page: LIMITS.deployments },
      { maxPages: 1 },
    );
    const { items } = parseDeployments(page.items);
    const deployments = await mapWithConcurrency(
      items.slice(0, LIMITS.deployments),
      4,
      async (deployment) => {
        try {
          const statuses = await this.options.client.request(
            "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
            { ...route, deployment_id: deployment.id, per_page: 1 },
          );
          return toDeployment(deployment, parseLatestDeploymentState(statuses.data));
        } catch {
          return toDeployment(deployment, "unknown");
        }
      },
    );
    return { status: "ok", data: deployments, complete: page.complete };
  }

  /** Fetches a statistics endpoint, retrying once if GitHub answers 202 (still computing). */
  private async fetchStatistics(path: string, route: { owner: string; repo: string }) {
    const request = () =>
      this.options.client.request(`GET /repos/{owner}/{repo}/stats/${path}`, route);
    let response = await request();
    if (response.status === 202) {
      await sleep(this.options.statsRetryDelayMs ?? 1500);
      response = await request();
    }
    return response;
  }

  private async fetchCommitActivity(route: {
    owner: string;
    repo: string;
  }): Promise<Resource<ReturnType<typeof parseCommitActivity>>> {
    const response = await this.fetchStatistics("commit_activity", route);
    if (response.status === 202) {
      return {
        status: "pending",
        message:
          "GitHub is still computing commit statistics for this repository. Refresh in a minute or two.",
      };
    }
    // 204: an empty repository has no statistics, which is data ("no commits"), not an error.
    const data = response.status === 204 ? [] : parseCommitActivity(response.data);
    return { status: "ok", data, complete: true };
  }

  private async fetchContributors(route: { owner: string; repo: string }) {
    const response = await this.fetchStatistics("contributors", route);
    if (response.status === 202) {
      // Statistics aren't ready; fall back to the all-time list so the section is not empty.
      const page = await fetchPaginated(
        this.options.client,
        "GET /repos/{owner}/{repo}/contributors",
        { ...route, per_page: 30 },
        { maxPages: 1 },
      );
      return {
        status: "ok" as const,
        data: parseContributorList(page.items),
        complete: false,
        note: "GitHub is still computing contributor statistics, so only all-time commit counts are shown (no recent-activity breakdown).",
      };
    }
    const data = response.status === 204 ? [] : parseContributorStats(response.data, this.now);
    return { status: "ok" as const, data, complete: true };
  }
}

/** Minimal stand-in repository for when metadata could not be read (access is flagged separately). */
function placeholderRepository(ref: RepoRef): Repository {
  const epoch = new Date(0).toISOString();
  return {
    id: 0,
    owner: ref.owner,
    name: ref.name,
    fullName: `${ref.owner}/${ref.name}`,
    description: null,
    htmlUrl: `https://github.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`,
    primaryLanguage: null,
    stars: 0,
    forks: 0,
    openIssuesAndPullsCount: 0,
    isPrivate: false,
    isArchived: false,
    isFork: false,
    defaultBranch: "main",
    license: null,
    topics: [],
    createdAt: epoch,
    updatedAt: epoch,
    pushedAt: null,
  };
}
