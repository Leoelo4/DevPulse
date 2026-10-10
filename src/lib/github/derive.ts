import type { FirstResponse, Issue, ReviewState } from "@/lib/domain/types";
import type { CommentInput, ReviewInput } from "./parse";

/**
 * Derives a pull request's review state from its review history.
 *
 * Per reviewer, only the most recent *decisive* review counts (APPROVED, CHANGES_REQUESTED or
 * DISMISSED); a later plain comment does not undo an approval or a change request, matching how
 * GitHub computes the review decision. PENDING reviews (drafts never submitted) are ignored.
 *
 *  - any reviewer's latest decisive review is CHANGES_REQUESTED → `changes_requested`
 *  - otherwise any latest decisive review is APPROVED → `approved`
 *  - otherwise reviewers were requested → `review_requested`
 *  - otherwise someone commented → `commented`
 *  - otherwise `no_reviews`
 */
export function deriveReviewState(
  reviews: readonly ReviewInput[],
  requestedReviewerCount: number,
): ReviewState {
  const submitted = reviews
    .filter((review) => review.state !== "PENDING" && review.submittedAt !== null)
    .sort((a, b) => Date.parse(a.submittedAt as string) - Date.parse(b.submittedAt as string));

  const latestDecisive = new Map<string, string>();
  let anyComment = false;

  for (const review of submitted) {
    const reviewer = review.reviewer ?? "(unknown)";
    if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED") {
      latestDecisive.set(reviewer, review.state);
    } else if (review.state === "DISMISSED") {
      latestDecisive.delete(reviewer);
    } else if (review.state === "COMMENTED") {
      anyComment = true;
    }
  }

  const decisive = [...latestDecisive.values()];
  if (decisive.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (decisive.includes("APPROVED")) return "approved";
  if (requestedReviewerCount > 0) return "review_requested";
  if (anyComment) return "commented";
  return "no_reviews";
}

/**
 * Resolves the first response time for each issue from a repository-wide comment feed.
 *
 * A "response" is the first comment by someone other than the issue's author. Only issues created
 * inside the inspected window can be resolved: for older issues the feed does not reach back far
 * enough, so their response is `unknown` rather than guessed. If the comment feed itself was
 * truncated, an issue with no comment found is `unknown` too (the reply may be in the part we did
 * not read); only a complete feed lets us say "no response yet".
 */
export function deriveFirstResponses(
  issues: readonly Issue[],
  comments: readonly CommentInput[],
  options: { windowStart: Date; commentsComplete: boolean },
): Issue[] {
  const byIssue = new Map<number, CommentInput[]>();
  for (const comment of comments) {
    const list = byIssue.get(comment.issueNumber);
    if (list) list.push(comment);
    else byIssue.set(comment.issueNumber, [comment]);
  }

  return issues.map((issue) => {
    if (Date.parse(issue.createdAt) < options.windowStart.getTime()) {
      return { ...issue, firstResponse: { status: "unknown" } satisfies FirstResponse };
    }

    const reply = (byIssue.get(issue.number) ?? [])
      .filter(
        (comment) =>
          comment.author !== issue.author &&
          Date.parse(comment.createdAt) >= Date.parse(issue.createdAt),
      )
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];

    const firstResponse: FirstResponse = reply
      ? { status: "responded", at: reply.createdAt }
      : options.commentsComplete
        ? { status: "none" }
        : { status: "unknown" };
    return { ...issue, firstResponse };
  });
}
