import { expect, test, type Page } from "@playwright/test";
import { enterDemo, visibleText } from "./helpers";

const rows = (page: Page) => page.getByRole("table").first().locator("tbody tr");

test.describe("repository explorer", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemo(page);
    await page.goto("/repositories");
    await expect(rows(page)).toHaveCount(6);
  });

  test("search filters rows and is reflected in the URL", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search repositories" }).fill("web");
    await expect(page).toHaveURL(/q=web/);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("pulse-web");
  });

  test("shows a helpful empty state when nothing matches, and can clear filters", async ({
    page,
  }) => {
    await page.getByRole("searchbox", { name: "Search repositories" }).fill("zzzz-no-match");
    await expect(visibleText(page, "No repositories match these filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(rows(page)).toHaveCount(6);
  });

  test("filters by health and CI status through the URL", async ({ page }) => {
    await page.goto("/repositories?health=at_risk");
    const atRisk = await rows(page).count();
    expect(atRisk).toBeGreaterThan(0);
    expect(atRisk).toBeLessThan(6);
    for (const row of await rows(page).all()) {
      await expect(row).toContainText("At risk");
    }

    await page.goto("/repositories?ci=failing");
    for (const row of await rows(page).all()) {
      await expect(row).toContainText("Failing");
    }
  });

  test("sorts by a column and exposes the sort state to assistive technology", async ({ page }) => {
    await page.getByRole("link", { name: /Stars/ }).click();
    await expect(page).toHaveURL(/sort=stars/);
    await expect(page.getByRole("columnheader", { name: /Stars/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(rows(page).first()).toContainText("pulse-api"); // most stars in the sample set

    await page.getByRole("link", { name: /Stars/ }).click();
    await expect(page.getByRole("columnheader", { name: /Stars/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(rows(page).first()).toContainText("infra-config"); // fewest stars
  });

  test("paginates", async ({ page }) => {
    await page.goto("/repositories?size=5&sort=name&dir=asc");
    await expect(rows(page)).toHaveCount(5);
    await expect(visibleText(page, "Showing 1–5 of 6")).toBeVisible();
    await expect(visibleText(page, "Page 1 of 2")).toBeVisible();

    await page.getByRole("link", { name: "Next page" }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(visibleText(page, "Showing 6–6 of 6")).toBeVisible();
    // On the last page "Next" is a disabled, non-link control (a hidden copy of page 1 may still
    // exist in the DOM, so only consider visible elements).
    await expect(page.getByLabel("Next page").filter({ visible: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("tolerates hostile query strings without erroring", async ({ page }) => {
    const response = await page.goto(
      "/repositories?sort=%27%3Bdrop&page=-9&size=9999&q=%3Cscript%3E",
    );
    expect(response?.status()).toBe(200);
    await expect(visibleText(page, "No repositories match these filters")).toBeVisible();
    await expect(page.locator("script", { hasText: "alert(" })).toHaveCount(0);
  });
});
