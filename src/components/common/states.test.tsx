// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderGit2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import AppError from "@/app/(app)/error";
import Loading from "@/app/(app)/loading";
import { LandingNotice } from "@/components/landing/landing-notice";
import type { Resource } from "@/lib/domain/types";
import { EmptyState } from "./empty-state";
import { ExternalLink } from "./external-link";
import { ResourceNotice } from "./resource-notice";
import { AggregateValue, aggregateCaption, StatTile } from "./stat-tile";
import {
  CiStatusBadge,
  HealthBadge,
  IndicatorBadge,
  ReviewBadge,
  RunStatusBadge,
} from "./status-badge";

describe("ResourceNotice", () => {
  const notice = (resource: Resource<unknown>) =>
    render(<ResourceNotice resource={resource} label="Pull requests" />);

  it("renders nothing for complete data, so it can sit under every section", () => {
    const { container } = notice({ status: "ok", data: [], complete: true });
    expect(container).toBeEmptyDOMElement();
  });

  it("flags partial data and states the limit", () => {
    notice({
      status: "ok",
      data: [],
      complete: false,
      note: "Only the 300 most recent were loaded.",
    });
    expect(screen.getByRole("note")).toHaveTextContent("Pull requests are a partial view");
    expect(screen.getByRole("note")).toHaveTextContent("300 most recent");
  });

  it("falls back to generic wording when a partial dataset has no note", () => {
    notice({ status: "ok", data: [], complete: false });
    expect(screen.getByRole("note")).toHaveTextContent(/older items are not included/);
  });

  it("explains data GitHub is still computing", () => {
    notice({ status: "pending", message: "GitHub is still computing statistics." });
    expect(screen.getByText(/still being computed/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub is still computing statistics/)).toBeInTheDocument();
  });

  it.each([
    ["forbidden", "Permission needed"],
    ["unauthorized", "Sign-in expired"],
    ["not_found", "Not found"],
    ["rate_limited", "GitHub rate limit reached"],
    ["error", "Could not load from GitHub"],
    ["disabled", "Not enabled for this repository"],
  ] as const)(
    "titles an unavailable dataset (%s) and shows GitHub's explanation",
    (reason, title) => {
      notice({ status: "unavailable", reason, message: "Specific explanation." });
      expect(
        screen.getByText(new RegExp(`Pull requests unavailable — ${title}`)),
      ).toBeInTheDocument();
      expect(screen.getByText(/Specific explanation\./)).toBeInTheDocument();
    },
  );
});

describe("EmptyState", () => {
  it("shows a title, description and action", () => {
    render(
      <EmptyState
        icon={FolderGit2}
        title="No repositories selected"
        description="Choose some."
        action={<button>Go</button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No repositories selected" })).toBeInTheDocument();
    expect(screen.getByText("Choose some.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
});

describe("Loading skeleton", () => {
  it("is announced as a loading status for assistive technology", () => {
    render(<Loading />);
    expect(screen.getByRole("status", { name: "Loading page" })).toBeInTheDocument();
  });
});

describe("Error boundary", () => {
  it("shows a recoverable alert, offers retry, and reports the digest for bug reports", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error("internal detail that must not be shown"), {
      digest: "abc123",
    });
    render(<AppError error={error} reset={reset} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("abc123");
    expect(alert).not.toHaveTextContent("internal detail");
    expect(consoleError).toHaveBeenCalledWith(error);

    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

describe("aggregate metrics are honest about coverage", () => {
  const aggregate = (
    overrides: Partial<Parameters<typeof AggregateValue>[0]["aggregate"]> = {},
  ) => ({
    value: 42,
    coveredRepos: 3,
    totalRepos: 3,
    exact: true,
    ...overrides,
  });

  it("shows exact totals plainly, and truncated ones as lower bounds", () => {
    const { rerender } = render(<AggregateValue aggregate={aggregate()} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    rerender(<AggregateValue aggregate={aggregate({ exact: false })} />);
    expect(screen.getByLabelText("at least")).toHaveTextContent("≥");
  });

  it("never shows zero for repositories that could not report", () => {
    render(<AggregateValue aggregate={aggregate({ value: 0, coveredRepos: 0 })} />);
    expect(screen.getByLabelText("Unavailable")).toHaveTextContent("—");
    expect(aggregateCaption(aggregate({ value: 0, coveredRepos: 0 }))).toBe(
      "Unavailable for all 3 repositories",
    );
  });

  it("explains partial coverage and truncation in the caption", () => {
    expect(aggregateCaption(aggregate({ coveredRepos: 2 }))).toBe("Based on 2 of 3 repositories");
    expect(aggregateCaption(aggregate({ exact: false }))).toMatch(/lower bound/);
    expect(aggregateCaption(aggregate())).toBeNull();
    expect(aggregateCaption(aggregate({ totalRepos: 0, coveredRepos: 0 }))).toBeNull();
  });

  it("StatTile always carries a definition control and a provenance label", () => {
    render(
      <StatTile
        label="Open issues"
        value={7}
        provenance="calculated"
        definition={<p>Defined.</p>}
        caption="context"
      />,
    );
    expect(screen.getByRole("button", { name: "About Open issues" })).toBeInTheDocument();
    expect(screen.getByText("Calculated")).toBeInTheDocument();
    expect(screen.getByText("context")).toBeInTheDocument();
  });
});

describe("status badges never rely on colour alone", () => {
  it("every state has a text label", () => {
    render(
      <div>
        <CiStatusBadge status="passing" />
        <CiStatusBadge status="failing" />
        <CiStatusBadge status="running" />
        <CiStatusBadge status="no_runs" />
        <CiStatusBadge status="unknown" />
        <HealthBadge level="at_risk" />
        <HealthBadge level="insufficient_data" />
        <IndicatorBadge status="poor" />
        <ReviewBadge state={null} />
        <RunStatusBadge run={{ status: "completed", conclusion: "timed_out" }} />
        <RunStatusBadge run={{ status: "queued", conclusion: null }} />
      </div>,
    );
    for (const label of [
      "Passing",
      "Failing",
      "Running",
      "No runs",
      "Unavailable",
      "At risk",
      "Not enough data",
      "Poor",
      "Not fetched",
      "Timed out",
      "Queued",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("ExternalLink", () => {
  it("opens GitHub pages safely in a new tab and announces that", () => {
    render(<ExternalLink href="https://github.com/o/r">repo</ExternalLink>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("opens GitHub in a new tab");
  });

  it("renders sample data (no URL) as inert, explained text rather than a link", () => {
    render(<ExternalLink href={null}>sample</ExternalLink>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByTitle("Sample data has no page on GitHub")).toBeInTheDocument();
  });
});

describe("LandingNotice", () => {
  const show = async (params: Record<string, string | string[] | undefined>) =>
    render(<>{await LandingNotice({ searchParams: Promise.resolve(params) })}</>);

  it.each([
    [{ disconnected: "1" }, /Disconnected/, /revoked/],
    [{ disconnected: "partial" }, /one step to check/, /github.com\/settings\/applications/],
    [{ reconnect: "1" }, /needs to be renewed/, /Sign in again/],
    [{ auth_error: "1" }, /did not complete/, /Nothing was changed/],
  ])("shows the right message for %j", async (params, title, body) => {
    await show(params);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(body)).toBeInTheDocument();
  });

  it("shows nothing for unknown or hostile values and never echoes query text", async () => {
    const { container } = await show({
      disconnected: "<img src=x onerror=alert(1)>",
      reconnect: "yes",
    });
    expect(container).toBeEmptyDOMElement();
    expect(container.innerHTML).not.toContain("onerror");
  });
});
