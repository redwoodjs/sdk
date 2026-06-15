import { mkdir, readFile, writeFile } from "fs/promises";
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
  "reproduces stale-client errors after redeploy",
  async ({ page, projectDir }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const webSocketErrors: string[] = [];

    // Instrument the page before any navigation so we capture all errors.
    await page.evaluateOnNewDocument(() => {
      // Capture console errors.
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        window.__rwsdkReproConsoleErrors.push(
          args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
        );
        originalError.apply(console, args);
      };

      // Capture WebSocket errors and close codes.
      const OriginalWebSocket = window.WebSocket;
      (window as any).WebSocket = class extends OriginalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          this.addEventListener("error", (event) => {
            window.__rwsdkReproWebSocketErrors.push(
              `WebSocket error on ${url}: ${(event as ErrorEvent).message || "unknown"}`,
            );
          });
          this.addEventListener("close", (event) => {
            if (!event.wasClean) {
              window.__rwsdkReproWebSocketErrors.push(
                `WebSocket closed on ${url}: code=${event.code} reason=${event.reason || "none"}`,
              );
            }
          });
        }
      };

      (window as any).__rwsdkReproConsoleErrors = [];
      (window as any).__rwsdkReproWebSocketErrors = [];
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.url()} | ${request.failure()?.errorText || "unknown"}`,
      );
    });

    const deploymentControl = createDeployment();

    // 1. Deploy build A and load the page.
    const deploymentA = await deploymentControl.start();
    console.log(`Build A deployed at ${deploymentA.url}`);

    await page.goto(deploymentA.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    await poll(async () => {
      const title = await page.evaluate(() => document.title);
      expect(title).toBe("Synced State Test");
      return true;
    });

    // 2. Establish a real use-synced-state WebSocket RPC session.
    await page.waitForSelector(".button-group button");
    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      const globalCounterButtonGroup = buttonGroups[1];
      const incrementButton = globalCounterButtonGroup?.querySelector("button");
      incrementButton?.click();
    });

    // Wait for the counter update to confirm the RPC worked.
    await poll(async () => {
      const text = await page.$$eval(
        ".counter-display",
        (els) => els[1]?.textContent,
      );
      const match = text?.match(/Count:\s*(\d+)/);
      return match && parseInt(match[1], 10) >= 1;
    });

    // 3. Modify a lazily-imported 'use client' component so build B has a
    // different chunk hash. The stale tab's Home chunk still references the
    // old Widget chunk hash, so clicking "Load Widget" after redeploy will
    // request a chunk that no longer exists.
    const widgetPath = join(projectDir, "src/app/components/Widget.tsx");
    const widgetContent = await readFile(widgetPath, "utf-8");
    await writeFile(
      widgetPath,
      widgetContent.replace(
        'className="widget-build-a"',
        'className="widget-build-b"',
      ),
    );

    // 4. Redeploy build B to the same URL.
    const deploymentB = await deploymentControl.redeploy();
    console.log(`Build B deployed at ${deploymentB.url}`);
    // Normalize host representation; Vite may report localhost while checkServerUp
    // reports [::1], but they are the same listening port.
    expect(new URL(deploymentB.url).port).toBe(new URL(deploymentA.url).port);

    // Give the new server a moment to fully start.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 5. From the stale tab, click "Load Widget". This triggers a dynamic
    // import resolved from the stale Home chunk, which references the old
    // Widget chunk hash that build B no longer serves.
    await page.evaluate(() => {
      document.getElementById("load-widget")?.click();
    });

    // The dynamic import may fail or hang; use a bounded wait.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Also try another RPC to surface the WebSocket staleness.
    await page.evaluate(() => {
      const buttonGroups = document.querySelectorAll(".button-group");
      const globalCounterButtonGroup = buttonGroups[1];
      const incrementButton = globalCounterButtonGroup?.querySelector("button");
      incrementButton?.click();
    });

    // Wait a bounded amount of time for errors to surface.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Collect errors from the page instrumentation.
    const instrumentedErrors = await page.evaluate(() => ({
      consoleErrors: (window as any).__rwsdkReproConsoleErrors as string[],
      webSocketErrors: (window as any).__rwsdkReproWebSocketErrors as string[],
    }));

    const allErrors = [
      ...consoleErrors,
      ...pageErrors,
      ...instrumentedErrors.consoleErrors,
      ...instrumentedErrors.webSocketErrors,
      ...failedRequests,
    ];

    console.log("Captured errors:");
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }

    // Save visual/console artifacts for inspection regardless of pass/fail.
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

    // 6. Assert both PRZM-295 failure-mode errors are present.
    const chunkErrorPattern = /Failed to fetch dynamically imported module:/i;
    const webSocketErrorPattern =
      /WebSocket connection to .* failed|WebSocket is already in CLOSING or CLOSED state|WebSocket closed on/i;

    const hasChunkError = allErrors.some((e) => chunkErrorPattern.test(e));
    const hasWebSocketError = allErrors.some((e) => webSocketErrorPattern.test(e));

    // We expect both errors on the unfixed mainline SDK behavior.
    expect(
      hasChunkError,
      "Expected a stale chunk 404 error ('Failed to fetch dynamically imported module')",
    ).toBe(true);
    expect(
      hasWebSocketError,
      "Expected a WebSocket disconnect error after DO restart",
    ).toBe(true);
  },
);
