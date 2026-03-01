import {
  createDeployment,
  poll,
  setupPlaygroundEnvironment,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
  autoStartDevServer: false,
});

testSDK.deploy(
  "keeps lazy dynamic imports working in a tab that survives redeploy",
  async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const requestFailures: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "unknown";
      requestFailures.push(`${request.url()} :: ${failure}`);
    });

    // --GROK--: We do a first deploy and keep this tab open across a second deploy
    // to model client-memory/version skew.
    const initialDeployControl = createDeployment();
    const initialDeployment = await initialDeployControl.start();
    await page.goto(initialDeployment.url);
    await waitForHydration(page);

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Hello World");
      expect(content).toContain("Load Lazy Message");
      expect(content).not.toContain(
        "Lazy message loaded after client-side dynamic import",
      );
      return true;
    });

    const redeployControl = createDeployment();
    await redeployControl.start();

    // --GROK--: Trigger client-side navigation in the existing tab before dynamic import.
    await page.evaluate(() => {
      window.history.pushState({}, "", "/?after-redeploy=1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Hello World");
      return true;
    });

    const button = await page.waitForSelector('[data-testid="load-lazy-message"]');
    await button?.click();

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain(
        "Lazy message loaded after client-side dynamic import",
      );
      return true;
    });

    const capturedErrors = [...pageErrors, ...consoleErrors, ...requestFailures];
    expect(capturedErrors.join("\n")).not.toContain(
      "Failed to fetch dynamically imported module",
    );
  },
);
