import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { enterDemo } from "./helpers";

/**
 * Automated WCAG 2.x A/AA checks. Automated checks catch roughly a third of accessibility problems
 * (contrast, names, roles, landmarks); they do not replace keyboard and screen-reader testing.
 */
async function expectNoViolations(page: Page, theme: "dark" | "light") {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  expect(summary, `${theme} theme accessibility violations on ${page.url()}`).toEqual([]);
}

const PAGES = [
  "/overview",
  "/repositories",
  "/repositories/sample-org/pulse-web",
  "/repositories/sample-org/pulse-web?tab=pull-requests",
  "/repositories/sample-org/pulse-web?tab=ci",
  "/repositories/sample-org/pulse-api?tab=releases",
  "/pull-requests",
  "/ci-releases",
  "/ci-releases?view=releases",
  "/settings",
];

for (const theme of ["dark", "light"] as const) {
  test.describe(`accessibility (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);
    });

    test("landing page", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^((?!dark).)*$/);
      await expectNoViolations(page, theme);
    });

    for (const path of PAGES) {
      test(path, async ({ page }) => {
        await enterDemo(page);
        await page.goto(path);
        await page.locator("main h1").first().waitFor();
        await expectNoViolations(page, theme);
      });
    }
  });
}

test("keyboard users can skip to content and reach the navigation", async ({ page }) => {
  await enterDemo(page);
  // Start from a fresh document load: after a client-side navigation Next moves focus into the page.
  await page.goto("/overview");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("charts can be read as data tables", async ({ page }) => {
  await enterDemo(page);
  const chart = page
    .getByRole("heading", { name: /Contribution activity/ })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await chart.getByRole("radio", { name: "Show data table" }).click();
  await expect(chart.getByRole("table")).toBeVisible();
  await expect(chart.getByRole("columnheader", { name: "Commits" })).toBeVisible();
});
