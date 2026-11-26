import fs from "fs-extra";
import { setTimeout as delay } from "node:timers/promises";
import path from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDev,
  testDeploy,
  trackPageErrors,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

const RECOVERY_NAVIGATION_LIMIT = 3;
const RELOAD_STABILITY_OBSERVATION_MS = 1_500;

testDev(
  "hydrates a page whose first element is not a div",
  async ({ page, url }) => {
    await page.goto(new URL("/non-div-widget", url).href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    expect(
      await page.$eval(
        "#hydrate-root > :first-child",
        (element) => element.tagName,
      ),
    ).toBe("A");

    await page.click("#non-div-widget-button");
    await poll(async () => {
      expect(
        await page.$eval(
          "#non-div-widget-button",
          (element) => element.textContent,
        ),
      ).toContain("Clicks: 1");
      return true;
    });
  },
);

async function provePermanentChunkFailureStopsReloading({
  page,
  url,
  chunkName,
}: {
  page: Parameters<typeof waitForHydration>[0];
  url: string;
  chunkName: string;
}) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await waitForHydration(page);

  const documentRequests: string[] = [];
  const blockedChunkRequests: string[] = [];

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (
      request.resourceType() === "script" &&
      request.url().includes(chunkName)
    ) {
      blockedChunkRequests.push(request.url());
      void request.respond({
        status: 404,
        contentType: "text/plain",
        body: "Permanently missing client chunk",
      });
      return;
    }

    if (request.resourceType() === "document") {
      documentRequests.push(request.url());
    }
    void request.continue();
  });

  await page.click("#link-to-widget");

  await poll(async () => {
    expect(documentRequests).toHaveLength(RECOVERY_NAVIGATION_LIMIT);
    expect(blockedChunkRequests.length).toBeGreaterThanOrEqual(
      RECOVERY_NAVIGATION_LIMIT,
    );
    return true;
  });

  // One startup-jitter window is enough for the old implementation to begin
  // another reload. Keep this negative observation narrow so the test proves
  // the count is stable without adding a broad arbitrary delay.
  await delay(RELOAD_STABILITY_OBSERVATION_MS);

  expect(documentRequests).toHaveLength(RECOVERY_NAVIGATION_LIMIT);
  expect(page.url()).toContain("/widget");
  expect(
    await page.$eval("h1", (element) => element.textContent?.trim()),
  ).toBe("Widget Page");
}

testDev(
  "stops reloading when a client chunk remains missing",
  async ({ page, url }) => {
    await provePermanentChunkFailureStopsReloading({
      page,
      url,
      chunkName: "Widget",
    });
  },
);

testDeploy(
  "recovers stale client modules after redeploy",
  async ({ browser, url, deployment, projectDir }) => {
    if (!deployment) {
      throw new Error("Expected a deployment test environment");
    }

    // context(chrsnymn, 25 Nov 2026): Retries must open the original build,
    // rather than reuse files changed by the previous attempt.
    let restoreBuild = false;
    for (const filePath of [
      "src/app/pages/NonDivWidget.tsx",
      "src/app/pages/Widget.tsx",
    ]) {
      const original = await fs.readFile(
        new URL(`../${filePath}`, import.meta.url),
        "utf-8",
      );
      const targetPath = path.join(projectDir, filePath);
      if ((await fs.readFile(targetPath, "utf-8")) !== original) {
        await fs.writeFile(targetPath, original);
        restoreBuild = true;
      }
    }
    const newWidgetPath = path.join(projectDir, "src/app/pages/NewWidget.tsx");
    if (await fs.pathExists(newWidgetPath)) {
      await fs.remove(newWidgetPath);
      restoreBuild = true;
    }
    if (restoreBuild) {
      await deployment.redeploy();
    }

    // context(chrsnymn, 25 Nov 2026): Each attempt needs its own reload budget.
    // Puppeteer's async disposal closes this context even when an assertion fails.
    await using attemptContext = await browser.createBrowserContext();
    const page = await attemptContext.newPage();
    const { get } = trackPageErrors(page);

    page.on("pageerror", (error) => {
      console.error("[recovery test] Browser JavaScript error:", error);
    });
    page.on("response", (response) => {
      if (
        response.request().resourceType() === "script" &&
        response.status() >= 400
      ) {
        console.error("[recovery test] Script HTTP error:", {
          url: response.url(),
          status: response.status(),
        });
      }
    });

    let initialResponse: Awaited<ReturnType<typeof page.goto>> = null;
    try {
      initialResponse = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await waitForHydration(page);
    } catch (error) {
      // context(chrsnymn, 26 Nov 2026): Preserve what the browser received
      // before teardown, while keeping the original startup failure.
      console.error("[recovery test] Initial page did not become ready:", {
        url: page.url(),
        status: initialResponse?.status(),
        contentType: initialResponse?.headers()["content-type"],
        cfRay: initialResponse?.headers()["cf-ray"],
        ...get(),
      });
      try {
        console.error(
          "[recovery test] Initial page text:",
          await page.evaluate(() => document.body?.innerText.slice(0, 2000)),
        );
      } catch (diagnosticError) {
        console.error(
          "[recovery test] Could not read page text:",
          diagnosticError,
        );
      }
      throw error;
    }

    // Sanity check: the home page loads.
    expect(await page.content()).toContain("Home");

    // context(chrsnymn, 30 Oct 2026): Keep a build-A tab open while a local
    // production redeploy changes the real NonDivWidget chunk hash. This
    // reproduces the deployment boundary without intercepting network traffic.
    const nonDivContext = await browser.createBrowserContext();
    try {
      const nonDivPage = await nonDivContext.newPage();
      const { get: getNonDivErrors } = trackPageErrors(nonDivPage);
      const recoveryLogs: string[] = [];
      const documentRequests: string[] = [];

      nonDivPage.on("console", (message) => {
        if (message.text().includes("[rwsdk:recovery]")) {
          recoveryLogs.push(message.text());
        }
      });
      nonDivPage.on("request", (request) => {
        if (request.resourceType() === "document") {
          documentRequests.push(request.url());
        }
      });

      await nonDivPage.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await waitForHydration(nonDivPage);
      documentRequests.length = 0;
      await nonDivPage.evaluate(() => {
        (
          window as Window & { __RWSDK_DEBUG_RECOVERY__?: boolean }
        ).__RWSDK_DEBUG_RECOVERY__ = true;
      });

      const nonDivWidgetPath = path.join(
        projectDir,
        "src/app/pages/NonDivWidget.tsx",
      );
      const nonDivBuildA = await fs.readFile(nonDivWidgetPath, "utf-8");
      const nonDivBuildB = nonDivBuildA.replace(
        "Non-div Widget Page",
        "Non-div Widget Page build B",
      );
      await fs.writeFile(nonDivWidgetPath, nonDivBuildB);
      await deployment.redeploy();

      await nonDivPage.click("#link-to-non-div-widget");

      await poll(
        async () => {
          expect(
            getNonDivErrors().failedRequests.some((request) =>
              request.includes("NonDivWidget"),
            ),
            "The old NonDivWidget module request should fail after redeploy",
          ).toBe(true);
          expect(
            recoveryLogs.some((message) =>
              message.includes("rootId div rootMatches true ok true"),
            ),
            "Recovery should accept the replacement page's hydrate root",
          ).toBe(true);
          expect(
            await nonDivPage.content(),
            "The recovered page should show build B",
          ).toContain("Non-div Widget Page build B");
          return true;
        },
        { timeout: 10_000 },
      );

      expect(documentRequests).toHaveLength(1);
      expect(nonDivPage.url()).toContain("/non-div-widget");
      await waitForHydration(nonDivPage);
      await nonDivPage.click("#non-div-widget-button");
      await poll(async () => {
        expect(
          await nonDivPage.$eval(
            "#non-div-widget-button",
            (element) => element.textContent,
          ),
        ).toContain("Clicks: 1");
        return true;
      });
    } finally {
      await nonDivContext.close();
    }

    // First cover a stale lookup entry whose old client chunk disappeared.
    const widgetPath = path.join(projectDir, "src/app/pages/Widget.tsx");
    const original = await fs.readFile(widgetPath, "utf-8");
    const buildB = original.replace("Widget build A", "Widget build B");
    await fs.writeFile(widgetPath, buildB);

    await deployment.redeploy();

    // The tab is still running build A. Its lookup points to the old Widget
    // chunk, which is no longer available after build B is deployed.
    await page.click("#link-to-widget");

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Widget build B");
      return true;
    });

    expect(page.url()).toContain("/widget");
    expect(
      get().failedRequests.some((request) => request.includes("Widget")),
    ).toBe(true);

    // Load build B normally, then keep that document open while build C adds
    // a client module that build B's in-memory lookup has never seen.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);
    await page.evaluate(() => {
      (window as any).__RWSDK_STALE_DOCUMENT__ = true;
    });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const documentRequests: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    page.on("request", (request) => {
      if (request.resourceType() === "document") {
        documentRequests.push(request.url());
      }
    });

    await fs.writeFile(
      newWidgetPath,
      `"use client";

import { useState } from "react";

export function NewWidget() {
  const [clicks, setClicks] = useState(0);

  return (
    <button id="new-widget" onClick={() => setClicks((count) => count + 1)}>
      New widget clicks: {clicks}
    </button>
  );
}
`,
    );
    await fs.writeFile(
      widgetPath,
      `import { NewWidget } from "./NewWidget";

export function Widget() {
  return (
    <div>
      <h1>Widget Page</h1>
      <NewWidget />
    </div>
  );
}
`,
    );

    await deployment.redeploy();

    // Build C's RSC response refers to NewWidget. The stale build B client
    // should suspend the lookup miss and recover with a full document reload.
    await page.click("#link-to-widget");

    await poll(async () => {
      const text = await page
        .$eval("#new-widget", (element) => element.textContent)
        .catch(() => null);
      expect(text).toContain("New widget clicks: 0");
      return true;
    });

    expect(page.url()).toContain("/widget");
    expect(
      documentRequests.some((requestUrl) =>
        new URL(requestUrl).pathname.endsWith("/widget"),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => (window as any).__RWSDK_STALE_DOCUMENT__),
    ).toBeUndefined();
    expect([...consoleErrors, ...pageErrors].join("\n")).not.toContain(
      "No module found for",
    );

    await waitForHydration(page);
    await page.click("#new-widget");
    await poll(async () => {
      const text = await page.$eval(
        "#new-widget",
        (element) => element.textContent,
      );
      expect(text).toContain("New widget clicks: 1");
      return true;
    });

    // The stale-deployment setup above is deployment-only because it replaces
    // the running build. Use a fresh tab context to exercise the same permanent
    // 404 limit without inheriting the earlier recovery timestamps.
    const permanentFailureContext = await browser.createBrowserContext();
    try {
      const permanentFailurePage = await permanentFailureContext.newPage();
      await provePermanentChunkFailureStopsReloading({
        page: permanentFailurePage,
        url,
        chunkName: "NewWidget",
      });
    } finally {
      await permanentFailureContext.close();
    }
  },
);
