import { expect, test } from "@playwright/test";
import { enterDemo } from "./helpers";

const PAGES = [
  "/overview",
  "/repositories",
  "/repositories/sample-org/pulse-web",
  "/repositories/sample-org/pulse-web?tab=pull-requests",
  "/repositories/sample-org/pulse-web?tab=issues",
  "/repositories/sample-org/pulse-web?tab=ci",
  "/repositories/sample-org/pulse-web?tab=releases",
  "/repositories/sample-org/pulse-web?tab=contributors",
  "/pull-requests",
  "/ci-releases",
  "/ci-releases?view=releases",
  "/settings",
];

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of PAGES) {
      test(`${path} has no page-level horizontal overflow`, async ({ page }) => {
        await enterDemo(page);
        await page.goto(path);
        await page.locator("main h1").first().waitFor();
        // Wide tables scroll inside their own container; the page itself must never scroll sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe("phone navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the sidebar is replaced by a drawer that reaches every page", async ({ page }) => {
    await enterDemo(page);
    // The desktop sidebar is hidden at this width.
    await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeHidden();

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Pull requests" }).click();

    await expect(page).toHaveURL(/\/pull-requests$/);
    await expect(drawer).toBeHidden(); // closes after navigating
    await expect(
      page.getByRole("heading", { level: 1, name: "Pull request insights" }),
    ).toBeVisible();
  });

  test("the drawer closes with Escape and returns focus to its trigger", async ({ page }) => {
    await enterDemo(page);
    const trigger = page.getByRole("button", { name: "Open navigation menu" });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
