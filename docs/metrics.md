# Metric reference

Every number in DevPulse is one of two kinds:

- **From GitHub** — a value the GitHub API reports directly (a count of items in a given state, a star count, a release's publish date).
- **Calculated** — derived by DevPulse from GitHub data. These depend on a _data window_ (how much history was loaded) and sometimes on a _threshold_ you can change in Settings.

The UI shows this label on every metric and offers a definition popover. This page is the long-form version. The implementations are pure functions in [`src/lib/metrics`](../src/lib/metrics) and each rule below has a unit test.

## Data windows

DevPulse never claims to show a complete history. Per repository it loads:

| Dataset                       | What is loaded                                                                          | Flagged as partial when                               |
| ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Pull requests                 | The 300 most recently updated (all states)                                              | More than 300 exist                                   |
| Reviews                       | History for the 25 most recently updated _open, non-draft_ pull requests                | Any open PR is beyond the 25 (shown as "Not fetched") |
| Issues                        | The 300 most recently updated items in GitHub's issues feed, with pull requests removed | More exist, or reply data is incomplete               |
| Issue comments                | Up to 500 comments from the last 30 days (for reply times)                              | More exist                                            |
| Workflow runs                 | Runs created in the last 30 days, up to 300                                             | More exist                                            |
| Releases / tags               | 30 most recent of each                                                                  | More exist                                            |
| Deployments                   | 8 most recent, each with its latest status                                              | —                                                     |
| Commit activity, contributors | GitHub's statistics (default branch, last 52 weeks)                                     | GitHub is still computing (shown as "pending")        |

Across repositories, totals add up only the repositories that reported data. If some could not (missing permission, rate limit), the figure says "Based on N of M repositories"; if any contributing dataset was truncated, it is shown as a lower bound with a "≥".

## Pull requests

| Metric                         | Kind        | Definition                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open / draft / ready           | From GitHub | Pull requests whose state is open; drafts are open but excluded from review metrics.                                                                                                                                                                                                                                                                                                                 |
| Merged                         | From GitHub | Pull requests with a merge time, within the loaded window (not an all-time total).                                                                                                                                                                                                                                                                                                                   |
| Closed unmerged                | From GitHub | Closed without merging, within the loaded window.                                                                                                                                                                                                                                                                                                                                                    |
| **Median / p90 time to merge** | Calculated  | Of `merged_at − created_at` for merged pull requests in the loaded data. p90 uses linear interpolation. Includes time spent as a draft or waiting. Pull requests with a merge time before their creation (bad data) are ignored.                                                                                                                                                                     |
| **Open PR age**                | Calculated  | Time since creation, grouped into <3 days, 3–7 days, 1–2 weeks, 2–4 weeks, >4 weeks.                                                                                                                                                                                                                                                                                                                 |
| **Stale**                      | Calculated  | Open and not updated for at least _N_ days (default 14; Settings). A stale pull request may be intentionally parked.                                                                                                                                                                                                                                                                                 |
| **Review state**               | Calculated  | Per reviewer, the latest _decisive_ review counts (approved, changes requested, or dismissed). Any change request → "changes requested"; else any approval → "approved"; else outstanding review requests → "review requested"; else a plain comment → "commented"; else "no reviews". A later plain comment does not undo an approval or change request. Pending (unsubmitted) reviews are ignored. |
| **Waiting for first review**   | Calculated  | Open, non-draft pull requests whose state is "no reviews" or "review requested".                                                                                                                                                                                                                                                                                                                     |
| **Weekly flow**                | Calculated  | Pull requests opened / merged / closed-without-merging per UTC week (weeks start on Sunday).                                                                                                                                                                                                                                                                                                         |

## Issues

| Metric                   | Kind        | Definition                                                                                                                                                                                 |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open / closed            | From GitHub | Issues by state, pull requests excluded (GitHub's own `open_issues_count` includes pull requests; DevPulse does not use it for issue counts).                                              |
| **Stale**                | Calculated  | Open and not updated for at least _N_ days (default 30).                                                                                                                                   |
| **Median first reply**   | Calculated  | Of (first comment by someone other than the issue's author − `created_at`), for issues opened in the last 30 days. Comments from before the issue existed are ignored; bot comments count. |
| **Awaiting a reply**     | Calculated  | Open issues in that window with no reply — reported only when the comment feed was read completely, otherwise the issue is "not measured".                                                 |
| **Median time to close** | Calculated  | Of `closed_at − created_at` for issues closed within the loaded data.                                                                                                                      |

## CI (GitHub Actions)

| Metric                     | Kind                     | Definition                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decisive run**           | Calculated               | A completed run that succeeded or failed (including timed out and startup failure). Cancelled, skipped, neutral and in-progress runs are excluded from reliability figures.                                                                          |
| **Success rate**           | Calculated               | Successes ÷ decisive runs, across all branches and workflows in the loaded window.                                                                                                                                                                   |
| **Current status**         | Calculated               | For the default branch: _failing_ if **any** workflow's latest decisive run failed; otherwise _running_ if a workflow has a newer run still executing; otherwise _passing_. A newer passing run of a different workflow does not hide a failing one. |
| **Failures (7 / 30 days)** | Calculated               | Decisive failed runs created in those windows, on any branch. One broken branch re-running can inflate this.                                                                                                                                         |
| **Median duration**        | Calculated (approximate) | Median of `updated_at − run_started_at` for completed runs. GitHub has no authoritative run duration; queue time and re-runs distort it.                                                                                                             |

**What CI status does _not_ tell you:** test coverage, test quality, flaky-test rates, other CI systems, or whether the software works in production. A passing latest run is not evidence of a healthy repository.

## Releases

| Metric                | Kind        | Definition                                                                                                                       |
| --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Latest release        | From GitHub | Newest published, non-draft GitHub Release.                                                                                      |
| **Days since latest** | Calculated  | Whole days between that release and now. Projects that ship via tags or package registries without GitHub Releases show nothing. |
| **Typical gap**       | Calculated  | Median days between consecutive published releases (needs two).                                                                  |

## Contributors and momentum

| Metric                    | Kind        | Definition                                                                                                                                                                |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributors              | From GitHub | People GitHub lists as contributors to the default branch (deleted accounts have no login and are skipped).                                                               |
| **Active (90 days)**      | Calculated  | Contributors with at least one commit in a week that ends within the trailing 90 days.                                                                                    |
| **Top contributor share** | Calculated  | The most active contributor's share of commits — over the last 90 days when available, otherwise all time (the UI says which). Commit counts are not effort or ownership. |
| **Commit momentum**       | Calculated  | Commits in the latest 4 weeks vs the 4 before; changes within ±10% are "flat". The current week may be incomplete.                                                        |

## Health indicators and recommendations

Six indicators per repository. Each states **what it measures** and **what it does not tell you**, and is `unknown` — never silently "good" — when there is not enough data.

| Indicator                             | Good                                           | Watch                                   | Poor                                  |
| ------------------------------------- | ---------------------------------------------- | --------------------------------------- | ------------------------------------- |
| Commit activity                       | ≥ 8 commits in ~30 days                        | 1–7                                     | 0                                     |
| Pull request backlog                  | ≤ 20% of open PRs stale                        | ≤ 50%                                   | > 50%                                 |
| Issue responsiveness                  | median first reply ≤ 48 h                      | ≤ 7 days, or >3 issues awaiting a reply | slower, or > 50% of open issues stale |
| CI reliability (≥ 5 decisive runs)    | ≥ 90%                                          | ≥ 70%                                   | < 70%                                 |
| Release cadence                       | within the overdue threshold (default 90 days) | up to 2×                                | beyond 2×                             |
| Contributor spread (≥ 2 contributors) | top share ≤ 60%                                | ≤ 85%                                   | > 85%                                 |

The repository-level **level** is a count-based roll-up, not a score: _No concerns_ only if nothing is poor, at most one indicator is a warning, and at least half the indicators had data; _At risk_ with two or more poor indicators; _Needs attention_ with one poor or two or more warnings; _Not enough data_ when fewer than half could be evaluated. "No concerns" means none of the _measured_ signals raised a flag — not that the project is well run.

Maintenance **recommendations** are generated from the same data (stale pull requests, pull requests waiting for review, unanswered issues, stale issues, a failing default branch, low CI success rate, an overdue release, a missing licence). They are prompts to look closer, not verdicts.

## Caching and freshness

| Data                                           | Standard TTL |
| ---------------------------------------------- | ------------ |
| CI workflow runs                               | 2 min        |
| Pull requests, reviews, issues, issue comments | 5 min        |
| Deployments                                    | 10 min       |
| Repository metadata                            | 15 min       |
| Releases                                       | 15 min       |
| Tags                                           | 30 min       |
| Commit and contributor statistics              | 60 min       |

_Fresh_ mode uses a quarter of these values and _Conservative_ four times. Failures and pending statistics are cached for one minute. Once a TTL expires, requests are conditional (`If-None-Match`), and GitHub does not count `304 Not Modified` responses against the rate limit. "Refresh now" clears the in-memory data; ETags are kept so the refresh stays cheap.
