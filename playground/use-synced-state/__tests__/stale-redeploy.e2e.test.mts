import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  createDeployment,
  poll,
  setupPlaygroundEnvironment,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

const ARTIFACT_DIR = join(process.cwd(), "screenshots");

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
  autoStartDeployment: false,
});

testSDK.deploy(
  "reloads stale tab when the use-synced-state WebSocket drops",
  async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.url()} | ${request.failure()?.errorText || "unknown"}`,
      );
    });

    // Capture every WebSocket the page creates so the test can forcibly close
    // the use-synced-state connection and assert the client reloads.
    await page.evaluateOnNewDocument(() => {
      const OriginalWebSocket = window.WebSocket;
      (window as any).__rwsdkWebSockets = [];
      (window as any).WebSocket = class extends OriginalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          (window as any).__rwsdkWebSockets.push({
            url: String(url),
            socket: this,
          });
        }
      };
    });

    const deploymentControl = createDeployment();
    const deployment = await deploymentControl.start();
    console.log(`Deployed at ${deployment.url}`);

    // 1. Load the page and establish a use-synced-state session.
    await page.goto(deployment.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    await poll(async () => {
      const title = await page.evaluate(() => document.title);
      expect(title).toBe("Synced State Test");
      return true;
    });

    // 2. Wait for the use-synced-state WebSocket to connect.
    const syncedStateWebSocket = await page.waitForFunction(
      () => {
        const sockets = (window as any).__rwsdkWebSockets as Array<{
          url: string;
          socket: WebSocket;
        }>;
        return sockets.find((s) => s.url.includes("/__synced-state"))?.socket;
      },
      { timeout: 10000 },
    );

    // 3. Mark the page so we can detect when it reloads.
    await page.evaluate(() => {
      (window as any).__rwsdkBeforeReload = true;
    });

    // 4. Forcibly close the WebSocket. In production this happens when the
    // worker/DO restarts after a deploy. The client should reload the page
    // rather than try to reconnect a stale session.
    await page.evaluate((socket) => {
      socket.close();
    }, syncedStateWebSocket);

    // 5. Wait for the stale tab to reload.
    await page.waitForFunction(
      () => !(window as any).__rwsdkBeforeReload,
      {
        timeout: 30000,
      },
    );

    // 6. Wait for the reloaded page to hydrate.
    await waitForHydration(page);

    await poll(async () => {
      const title = await page.evaluate(() => document.title);
      expect(title).toBe("Synced State Test");
      return true;
    });

    // 7. Trigger the lazy Widget load on the fresh page.
    await page.evaluate(() => {
      document.getElementById("load-widget")?.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const widgetLoaded = await page.evaluate(() => {
      return document.body.textContent?.includes("Widget loaded") ?? false;
    });

    // 8. Collect artifacts for inspection.
    const allErrors = [...consoleErrors, ...failedRequests];

    await mkdir(ARTIFACT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = join(
      ARTIFACT_DIR,
      `stale-redeploy-${timestamp}-page.png`,
    );
    const consolePath = join(
      ARTIFACT_DIR,
      `stale-redeploy-${timestamp}-console.log`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await writeFile(
      consolePath,
      allErrors.map((e) => `- ${e}`).join("\n"),
      "utf-8",
    );
    console.log(`Screenshot saved to ${screenshotPath}`);
    console.log(`Console log saved to ${consolePath}`);

    // 9. Assertions: the stale tab reloaded and the Widget chunk loaded.
    expect(
      widgetLoaded,
      "Expected the Widget to load successfully after the stale tab reloaded",
    ).toBe(true);

    const chunk404Pattern = /Failed to fetch dynamically imported module:/i;
    const hasChunk404 = allErrors.some((e) => chunk404Pattern.test(e));
    expect(
      hasChunk404,
      "Did not expect a stale chunk 404 after the page reloaded",
    ).toBe(false);
  },
);
