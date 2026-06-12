import {
  createDeployment,
  poll,
  setupPlaygroundEnvironment,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

// Speed up reconnect attempts so the test can observe the stale-client
// reload shortly after the preview server is replaced.
process.env.VITE_RWSDK_SYNCED_STATE_TEST_FAST_RECONNECT = "1";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
});

testSDK.deploy(
  "reloads stale use-synced-state clients on the next RPC message",
  async ({ page }) => {
    const deploymentControl = createDeployment();

    // 1. Deploy and load the page.
    const deployment = await deploymentControl.start();
    await page.goto(deployment.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    // 2. Establish a real WebSocket RPC session by clicking a counter.
    await page.waitForSelector(".button-group button");
    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      buttonGroups[1]?.querySelector("button")?.click();
    });

    // 3. Simulate a deployment that changes the worker build ID while the
    // WebSocket connection stays open. Preview-mode redeploys restart the
    // server and drop existing WebSockets, so we use a test-only route to
    // mutate the running worker's perceived build ID without disconnecting
    // established sessions.
    const setBuildIdUrl = new URL("/__stale-test/set-build-id/", deployment.url);
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

    // 4. The next RPC call should be rejected as stale and trigger a full reload.
    const navigationPromise = page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      buttonGroups[1]?.querySelector("button")?.click();
    });

    await navigationPromise;

    // 5. Clear the simulated deployment so the reloaded client does not
    // keep tripping the stale check and reloading in a loop.
    const clearBuildIdUrl = new URL("/__stale-test/set-build-id/", deployment.url);
    const clearResponse = await page.evaluate(
      async (targetUrl) => {
        const response = await fetch(targetUrl);
        return { status: response.status, text: await response.text() };
      },
      clearBuildIdUrl.toString(),
    );
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.text).toBe("ok");

    // 6. After reload the page should have rehydrated successfully.
    await waitForHydration(page);
    await page.waitForSelector(".counter-display");
  },
);
