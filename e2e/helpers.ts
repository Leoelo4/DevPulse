import { expect, type Page } from "@playwright/test";

/**
 * The page's `main` landmark. Free-text lookups are scoped to it because a streamed page also
 * embeds its RSC payload in `<script>` tags, which a bare `getByText` can match a second time.
 */
export const main = (page: Page) => page.getByRole("main");

/**
 * Visible text inside `main`. Next keeps previously visited routes in the DOM, hidden, so that
 * back/forward navigation is instant; a bare text locator can therefore match a hidden copy.
 */
export const visibleText = (page: Page, text: string | RegExp) =>
  main(page).getByText(text).filter({ visible: true });

/** Enters demo mode through the landing page, exactly as a visitor would. */
export async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
}
