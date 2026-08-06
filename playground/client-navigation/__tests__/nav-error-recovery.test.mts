import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

// A client navigation whose RSC fetch fails must not strand the browser on
// the new URL with the old page rendered. The default recovery is a hard
// navigation to the intended URL, which always lands on matching URL and
// content. This test aborts the navigation fetch once and asserts the page
// recovers to the target route.

testDevAndDeploy(
  "failed client navigation recovers with a full page load",
  async ({ browser, url }) => {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.goto(`${url}/list?v=a`);
      await waitForHydration(page);

      // Fail the next RSC navigation request once; let everything else through.
      await page.setRequestInterception(true);
      let aborted = false;
      page.on("request", (request) => {
        if (!aborted && request.url().includes("__rsc")) {
          aborted = true;
          request.abort();
          return;
        }
        request.continue();
      });

      await page.click('[data-testid="toggle"]');

      // Recovery is a full page load of /list?v=b, so the heading must reach
      // "b" without any further intervention.
      await poll(async () => {
        const heading = await page
          .$eval(
            '[data-testid="current-v"]',
            (el) => el.textContent?.trim() ?? null,
          )
          .catch(() => null);
        expect(heading).toBe("b");
        return true;
      });
    } finally {
      await context.close();
    }
  },
);
