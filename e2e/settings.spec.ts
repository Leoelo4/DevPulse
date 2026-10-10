import { expect, test } from "@playwright/test";
import { enterDemo, visibleText } from "./helpers";

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemo(page);
    await page.goto("/settings");
  });

  test("theme can be switched and is remembered across reloads", async ({ page }) => {
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/); // dark is the default

    await page.getByRole("radio", { name: /Light/ }).click();
    await expect(html).not.toHaveClass(/dark/);

    await page.reload();
    await expect(html).not.toHaveClass(/dark/);

    await page.getByRole("radio", { name: /Dark/ }).click();
    await expect(html).toHaveClass(/dark/);
  });

  test("the header theme menu offers light, dark and system", async ({ page }) => {
    await page.getByRole("button", { name: "Change colour theme" }).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(3);
  });

  test("rejects invalid thresholds with clear messages and saves nothing", async ({ page }) => {
    await page.getByLabel("Stale pull request (days)").fill("0");
    await page.getByLabel("Stale issue (days)").fill("9999");
    await page.getByRole("button", { name: "Save thresholds" }).click();

    await expect(visibleText(page, "Nothing was saved")).toBeVisible();
    await expect(visibleText(page, "Must be at least 1")).toBeVisible();
    await expect(visibleText(page, "Must be at most 365")).toBeVisible();
    await expect(page.getByLabel("Stale pull request (days)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("saved thresholds persist and change calculated metrics", async ({ page }) => {
    // With a 1-day stale threshold, far more open PRs count as stale than with the 14-day default.
    await page.goto("/pull-requests");
    const tile = page.getByRole("region", { name: "Pull request metrics" });
    const staleBefore = Number(
      await tile.getByText("Stale open PRs").locator("xpath=following::div[1]").innerText(),
    );

    await page.goto("/settings");
    await page.getByLabel("Stale pull request (days)").fill("1");
    await page.getByRole("button", { name: "Save thresholds" }).click();
    await expect(page.getByText("Thresholds saved").first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Stale pull request (days)")).toHaveValue("1");

    await page.goto("/pull-requests");
    const staleAfter = Number(
      await tile.getByText("Stale open PRs").locator("xpath=following::div[1]").innerText(),
    );
    expect(staleAfter).toBeGreaterThan(staleBefore);
    await expect(tile.getByText("No activity for 1+ days")).toBeVisible();

    // Reset returns to defaults.
    await page.goto("/settings");
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByLabel("Stale pull request (days)")).toHaveValue("14");
  });

  test("a tampered preferences cookie falls back to defaults instead of breaking pages", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "devpulse-prefs", value: "%7Bnot-json", url: "http://localhost:3200" },
    ]);
    const response = await page.goto("/overview");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });
});
