/**
 * Captures the README screenshots from a running DevPulse instance in demo mode.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run screenshots               # in another (BASE_URL defaults to http://localhost:3000)
 *
 * Screenshots show generated sample data only, and the app labels it as such on every screen.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContextOptions } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = "docs/screenshots";

interface Shot {
  file: string;
  path: string;
  theme: "dark" | "light";
  viewport: { width: number; height: number };
  /** Selector to wait for before capturing, so charts have rendered. */
  waitFor: string;
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

const SHOTS: Shot[] = [
  {
    file: "overview-dark.png",
    path: "/overview",
    theme: "dark",
    viewport: desktop,
    waitFor: ".recharts-surface",
  },
  {
    file: "overview-light.png",
    path: "/overview",
    theme: "light",
    viewport: desktop,
    waitFor: ".recharts-surface",
  },
  {
    file: "repositories-dark.png",
    path: "/repositories",
    theme: "dark",
    viewport: desktop,
    waitFor: "table",
  },
  {
    file: "repository-dark.png",
    path: "/repositories/sample-org/pulse-web",
    theme: "dark",
    viewport: desktop,
    waitFor: ".recharts-surface",
  },
  {
    file: "pull-requests-dark.png",
    path: "/pull-requests",
    theme: "dark",
    viewport: desktop,
    waitFor: ".recharts-surface",
  },
  {
    file: "ci-releases-dark.png",
    path: "/ci-releases",
    theme: "dark",
    viewport: desktop,
    waitFor: ".recharts-surface",
  },
  {
    file: "overview-mobile-dark.png",
    path: "/overview",
    theme: "dark",
    viewport: phone,
    waitFor: "main h1",
  },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
  for (const shot of SHOTS) {
    const options: BrowserContextOptions = {
      baseURL,
      viewport: shot.viewport,
      deviceScaleFactor: 1,
    };
    const context = await browser.newContext(options);
    await context.addInitScript((theme) => window.localStorage.setItem("theme", theme), shot.theme);
    const page = await context.newPage();

    await page.goto("/");
    await page.getByRole("button", { name: "Explore the demo" }).click();
    await page.waitForURL("**/overview");
    await page.goto(shot.path);
    await page.locator(shot.waitFor).first().waitFor();
    await page.waitForTimeout(600); // let chart layout settle
    await page.screenshot({ path: `${outDir}/${shot.file}` });
    console.log(`captured ${outDir}/${shot.file}`);
    await context.close();
  }
} finally {
  await browser.close();
}
