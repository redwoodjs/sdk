import {
  setupPlaygroundEnvironment,
  testDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
});

testDeploy(
  "reloads stale clients on active use-synced-state sessions",
  async ({ page, url }) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHydration(page);

    // Make sure a real WebSocket RPC session is active by clicking a counter.
    await page.waitForSelector(".button-group button");
    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      const globalCounterButtonGroup = buttonGroups[1];
      const incrementButton = globalCounterButtonGroup?.querySelector("button");
      incrementButton?.click();
    });

    // Simulate a deployment that changes the worker build ID while the
    // WebSocket connection stays open. Routes are normalized to end in `/`,
    // so request the trailing-slash URL directly to avoid a redirect that
    // would drop the query parameter.
    const setBuildIdUrl = new URL("/__stale-test/set-build-id/", url);
    setBuildIdUrl.searchParams.set("version", "stale-test-build");
    const setResponse = await page.evaluate(
      async (targetUrl) => {
        const response = await fetch(targetUrl);
        return { status: response.status, text: await response.text() };
      },
      setBuildIdUrl.toString(),
    );
    expect(setResponse.status).toBe(200);
    expect(setResponse.text).toBe("ok");

    // The next RPC call should be rejected as stale and trigger a full reload.
    const navigationPromise = page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      const globalCounterButtonGroup = buttonGroups[1];
      const incrementButton = globalCounterButtonGroup?.querySelector("button");
      incrementButton?.click();
    });

    await navigationPromise;

    // After reload the page should have rehydrated successfully.
    await waitForHydration(page);
    await page.waitForSelector(".counter-display");
  },
);
