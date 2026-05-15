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

    // context(justinvdm, 17 Mar 2026): The e2e harness extracts just the origin
    // from Vite's output, stripping the base path. We append it here.
    await page.goto(`${url}/app/`);

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Hello from Base Path");
      return true;
    });

    const errors = errorTracker.get();
    if (errors.failedRequests.length > 0) {
      console.error("Failed requests:", errors.failedRequests);
    }
    expect(errors.failedRequests).toHaveLength(0);
  },
);
