import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  trackPageErrors,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders page and loads assets with base path",
  async ({ page, url }) => {
    const errorTracker = trackPageErrors(page);

    // --GROK--: The e2e harness extracts just the origin (http://localhost:PORT)
    // from Vite's output, stripping the base path. We need to append it.
    await page.goto(`${url}/app/`);

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Hello from Base Path");
      return true;
    });

    // --GROK--: Verify no failed requests — this catches asset 404s (CSS, JS, favicons)
    // which would indicate the base path is not being handled correctly.
    const errors = errorTracker.get();
    if (errors.failedRequests.length > 0) {
      console.error("Failed requests:", errors.failedRequests);
    }
    expect(errors.failedRequests).toHaveLength(0);
  },
);
