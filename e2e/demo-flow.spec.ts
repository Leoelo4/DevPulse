import { expect, test } from "@playwright/test";
import { enterDemo, visibleText } from "./helpers";

test.describe("landing and demo mode", () => {
  test("offers demo mode and explains why live mode is unavailable when unconfigured", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("repositories");
    await expect(page.getByRole("button", { name: "Explore the demo" })).toBeEnabled();

    const connect = page.getByRole("button", { name: /Connect GitHub/ });
    await expect(connect).toBeDisabled();
    await expect(visibleText(page, /isn't configured on this deployment/)).toBeVisible();
    await expect(visibleText(page, "GITHUB_CLIENT_ID")).toBeVisible();
  });

  test("entering demo mode shows an unmistakable sample-data banner", async ({ page }) => {
    await enterDemo(page);
    await expect(page.getByRole("status").filter({ hasText: "demo mode" })).toContainText(
      "none of it comes from GitHub",
    );
    await expect(page.getByRole("banner").getByText("Demo mode · sample data")).toBeVisible();
  });

  test("overview shows defined metrics with provenance labels", async ({ page }) => {
    await enterDemo(page);
    const metrics = page.getByRole("region", { name: "Key metrics" });
    await expect(metrics.getByText("Open pull requests")).toBeVisible();
    await expect(metrics.getByText("Workflow failures · 7 days")).toBeVisible();
    await expect(metrics.getByText("From GitHub").first()).toBeVisible();
    await expect(metrics.getByText("Calculated").first()).toBeVisible();

    // Every metric offers a plain-language definition.
    await metrics.getByRole("button", { name: "About Open issues" }).click();
    // Popover content is rendered in a portal outside `main`, exposed as a dialog.
    await expect(page.getByRole("dialog")).toContainText("excluding pull requests");
  });

  test("exiting demo returns to the landing page and re-protects the app", async ({ page }) => {
    await enterDemo(page);
    await page.getByRole("button", { name: "Exit demo" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/overview");
    await expect(page).toHaveURL("/");
  });
});

test.describe("navigation", () => {
  test("sidebar reaches every page and marks the current one", async ({ page }) => {
    await enterDemo(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    const pages: Array<[string, RegExp, string]> = [
      ["Repositories", /\/repositories$/, "Repositories"],
      ["Pull requests", /\/pull-requests$/, "Pull request insights"],
      ["CI & releases", /\/ci-releases$/, "CI & releases"],
      ["Settings", /\/settings$/, "Settings"],
      ["Overview", /\/overview$/, "Overview"],
    ];
    for (const [link, url, heading] of pages) {
      await nav.getByRole("link", { name: link }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
    }
  });

  test("a repository opens from the explorer and its sections are navigable", async ({ page }) => {
    await enterDemo(page);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Repositories" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Repositories" })).toBeVisible();
    await page
      .getByRole("table")
      .getByRole("link", { name: /pulse-api/ })
      .click();
    await expect(page).toHaveURL(/\/repositories\/sample-org\/pulse-api$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("pulse-api");

    const sections = page.getByRole("navigation", { name: "Repository sections" });
    for (const [name, expected] of [
      ["Pull requests", "Open pull requests"],
      ["Issues", "Open issues"],
      ["CI", "Workflow outcomes by day"],
      ["Releases", "Release history"],
      ["Contributors", "Top contributor share"],
    ] as const) {
      await sections.getByRole("link", { name }).click();
      await expect(sections.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      await expect(visibleText(page, expected).first()).toBeVisible();
    }
  });

  test("sample repositories have no GitHub link, and the UI says so", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/repositories/sample-org/pulse-api");
    await expect(visibleText(page, "No GitHub page (sample data)")).toBeVisible();
    await expect(page.getByRole("link", { name: /View on GitHub/ })).toHaveCount(0);
  });

  test("unknown or malformed repository URLs return a not-found page, not an error", async ({
    page,
  }) => {
    await enterDemo(page);
    for (const path of [
      "/repositories/sample-org/does-not-exist",
      "/repositories/someone-else/pulse-api",
      "/repositories/sample-org/%E0%A4%A", // malformed percent-encoding
      "/repositories/sample-org/..%2F..%2Fetc",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
    }
  });
});

test.describe("protected routes", () => {
  test("anonymous visitors are redirected to the landing page", async ({ page }) => {
    for (const path of [
      "/overview",
      "/repositories",
      "/repositories/sample-org/pulse-api",
      "/pull-requests",
      "/ci-releases",
      "/settings",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
  });

  test("a forged mode cookie value does not grant access", async ({ page, context }) => {
    await context.addCookies([
      { name: "devpulse-mode", value: "admin", url: "http://localhost:3200" },
    ]);
    await page.goto("/overview");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toHaveCount(0);
    await expect(page).toHaveURL("/");
  });
});
