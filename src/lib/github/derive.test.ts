import { describe, expect, it } from "vitest";
import { daysAgo, hoursAgo, issue, NOW } from "@/test/builders";
import { deriveFirstResponses, deriveReviewState } from "./derive";
import type { CommentInput, ReviewInput } from "./parse";

const review = (reviewer: string, state: string, hours: number): ReviewInput => ({
  reviewer,
  state,
  submittedAt: hoursAgo(hours),
});

describe("deriveReviewState", () => {
  it("is no_reviews with no reviews and no requests", () => {
    expect(deriveReviewState([], 0)).toBe("no_reviews");
  });

  it("is review_requested when reviewers were asked but nobody has reviewed", () => {
    expect(deriveReviewState([], 2)).toBe("review_requested");
  });

  it("is approved after an approval", () => {
    expect(deriveReviewState([review("a", "APPROVED", 5)], 0)).toBe("approved");
  });

  it("changes_requested beats approved from another reviewer", () => {
    expect(
      deriveReviewState([review("a", "APPROVED", 10), review("b", "CHANGES_REQUESTED", 5)], 0),
    ).toBe("changes_requested");
  });

  it("uses each reviewer's latest decisive review: approval after changes-requested clears it", () => {
    expect(
      deriveReviewState([review("a", "CHANGES_REQUESTED", 10), review("a", "APPROVED", 2)], 0),
    ).toBe("approved");
  });

  it("a later plain comment does not undo an approval or a change request", () => {
    expect(deriveReviewState([review("a", "APPROVED", 10), review("a", "COMMENTED", 2)], 0)).toBe(
      "approved",
    );
    expect(
      deriveReviewState([review("a", "CHANGES_REQUESTED", 10), review("a", "COMMENTED", 2)], 0),
    ).toBe("changes_requested");
  });

  it("a dismissed review no longer counts", () => {
    expect(
      deriveReviewState([review("a", "CHANGES_REQUESTED", 10), review("a", "DISMISSED", 5)], 0),
    ).toBe("no_reviews");
  });

  it("ignores pending (unsubmitted) reviews", () => {
    expect(deriveReviewState([{ reviewer: "a", state: "PENDING", submittedAt: null }], 0)).toBe(
      "no_reviews",
    );
  });

  it("is commented when there are only comment reviews and no outstanding requests", () => {
    expect(deriveReviewState([review("a", "COMMENTED", 3)], 0)).toBe("commented");
  });

  it("outstanding review requests take precedence over plain comments", () => {
    expect(deriveReviewState([review("a", "COMMENTED", 3)], 1)).toBe("review_requested");
  });

  it("is order-independent (sorts by submission time)", () => {
    expect(
      deriveReviewState([review("a", "APPROVED", 2), review("a", "CHANGES_REQUESTED", 10)], 0),
    ).toBe("approved");
  });

  it("tolerates reviews from deleted users", () => {
    expect(
      deriveReviewState([{ reviewer: null, state: "APPROVED", submittedAt: hoursAgo(1) }], 0),
    ).toBe("approved");
  });
});

describe("deriveFirstResponses", () => {
  const windowStart = new Date(NOW.getTime() - 30 * 86_400_000);
  const comment = (issueNumber: number, author: string | null, hours: number): CommentInput => ({
    issueNumber,
    author,
    createdAt: hoursAgo(hours),
  });
  const recent = (number: number, author = "reporter") =>
    issue({ number, author, createdAt: daysAgo(5), firstResponse: { status: "unknown" } });

  it("finds the first comment from someone other than the author", () => {
    const [result] = deriveFirstResponses(
      [recent(1)],
      [comment(1, "reporter", 110), comment(1, "maintainer", 100), comment(1, "other", 90)],
      { windowStart, commentsComplete: true },
    );
    expect(result?.firstResponse).toEqual({ status: "responded", at: hoursAgo(100) });
  });

  it("does not count the author's own comments, or comments from before the issue existed", () => {
    const [result] = deriveFirstResponses(
      [recent(1)],
      [comment(1, "reporter", 100), comment(1, "maintainer", 200)], // 200h ago is before 5 days ago (120h)
      { windowStart, commentsComplete: true },
    );
    expect(result?.firstResponse).toEqual({ status: "none" });
  });

  it("reports 'none' only when the comment feed was read completely", () => {
    const [complete] = deriveFirstResponses([recent(1)], [], {
      windowStart,
      commentsComplete: true,
    });
    const [truncated] = deriveFirstResponses([recent(1)], [], {
      windowStart,
      commentsComplete: false,
    });
    expect(complete?.firstResponse.status).toBe("none");
    expect(truncated?.firstResponse.status).toBe("unknown");
  });

  it("marks issues older than the inspected window as unknown, never 'none'", () => {
    const old = issue({ number: 2, createdAt: daysAgo(60) });
    const [result] = deriveFirstResponses([old], [], { windowStart, commentsComplete: true });
    expect(result?.firstResponse.status).toBe("unknown");
  });

  it("does not mutate its inputs", () => {
    const issues = [recent(1)];
    deriveFirstResponses(issues, [comment(1, "x", 50)], { windowStart, commentsComplete: true });
    expect(issues[0]?.firstResponse).toEqual({ status: "unknown" });
  });

  it("treats comments from deleted users (null author) as a response from someone else", () => {
    const [result] = deriveFirstResponses([recent(1)], [comment(1, null, 50)], {
      windowStart,
      commentsComplete: true,
    });
    expect(result?.firstResponse.status).toBe("responded");
  });
});
