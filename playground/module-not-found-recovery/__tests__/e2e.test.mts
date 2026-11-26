import fs from "fs-extra";
import { setTimeout as delay } from "node:timers/promises";
import path from "path";
import {
  type Page,
  poll,
  recordDiagnostic,
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

type ClientManifest = Record<string, { file: string }>;

// context(chrsnymn, 26 Nov 2026): Deployment completion does not prove that
// the browser sees the expected build or that an old chunk has disappeared.
// Prepare those conditions separately; never reload the stale tab to recover it.
async function waitForDeployedBuild(
  page: Page,
  projectDir: string,
  url: string,
  missingAsset?: string,
): Promise<ClientManifest> {
  const manifest: ClientManifest = await fs.readJSON(
    path.join(projectDir, "dist/client/.vite/manifest.json"),
  );
  const expectedClient = new URL(
    manifest["src/client.tsx"].file,
    new URL("/", url),
  ).href;
  const redirect: { configPath: string } = await fs.readJSON(
    path.join(projectDir, ".wrangler/deploy/config.json"),
  );
  const configPath = path.resolve(
    projectDir,
    ".wrangler/deploy",
    redirect.configPath,
  );
  const config: { main: string; assets: { directory: string } } =
    await fs.readJSON(configPath);
  const assetDirectory = path.resolve(
    path.dirname(configPath),
    config.assets.directory,
  );
  const emittedFiles = await fs.readdir(assetDirectory, { recursive: true });
  const ignorePath = path.join(assetDirectory, ".assetsignore");
  recordDiagnostic("recovery.build", {
    url,
    expectedClient,
    configPath,
    assetDirectory,
    emittedFiles,
    assetsIgnore: (await fs.pathExists(ignorePath))
      ? await fs.readFile(ignorePath, "utf-8")
      : null,
    manifest,
  });
  expect(
    await fs.pathExists(
      path.join(assetDirectory, manifest["src/client.tsx"].file),
    ),
    "Build output must contain the startup file in Wrangler's asset directory",
  ).toBe(true);
  expect(
    await fs.readFile(
      path.resolve(path.dirname(configPath), config.main),
      "utf-8",
    ),
    "Built Worker must reference the expected startup URL",
  ).toContain(new URL(expectedClient).pathname);
  const assetErrors: string[] = [];
  const documents: Awaited<ReturnType<Page["goto"]>>[] = [];
  const { get } = trackPageErrors(page);
  let preloadUrls: string[] = [];
  let missingAssetStatus: number | undefined;
  const onResponse = (response: Awaited<ReturnType<Page["waitForResponse"]>>) => {
    if (["script", "stylesheet"].includes(response.request().resourceType())) {
      recordDiagnostic("recovery.asset.response", {
        url: response.url(),
        status: response.status(),
        cfRay: response.headers()["cf-ray"],
        expectedClient,
      });
    }
    if (
      ["script", "stylesheet"].includes(response.request().resourceType()) &&
      response.status() >= 400
    ) {
      assetErrors.push(`${response.status()} ${response.url()}`);
    }
  };
  const onRequestFailed = (
    request: Awaited<ReturnType<Page["waitForRequest"]>>,
  ) => {
    if (["script", "stylesheet"].includes(request.resourceType())) {
      assetErrors.push(`${request.url()} ${request.failure()?.errorText}`);
      recordDiagnostic("recovery.asset.failed", {
        url: request.url(),
        error: request.failure()?.errorText,
        expectedClient,
      });
    }
  };
  const onPageError = (error: unknown) => {
    console.error("[recovery test] Browser JavaScript error:", error);
  };
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  page.on("pageerror", onPageError);
  await page.setCacheEnabled(false);
  try {
    await poll(async () => {
      assetErrors.length = 0;
      const response = await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
      documents.push(response);
      recordDiagnostic("recovery.document", {
        url: page.url(),
        status: response?.status(),
        cfRay: response?.headers()["cf-ray"],
        expectedClient,
        navigationAttempt: documents.length,
      });
      expect(response?.status(), "Deployment page should return HTTP 200").toBe(
        200,
      );
      preloadUrls = await page.$$eval("link", (links) =>
        links
          .filter((link) => link.rel === "modulepreload")
          .map((link) => link.href),
      );
      recordDiagnostic("recovery.preloads", { url: page.url(), preloadUrls });
      expect(
        preloadUrls,
        "Deployment should serve the expected build's client entry",
      ).toContain(expectedClient);
      expect(
        assetErrors,
        "Deployment scripts and styles should load successfully",
      ).toEqual([]);
      if (missingAsset) {
        const oldAssetResponse = await page.evaluate(
          async ({ asset, timeout }) => {
            const result = await fetch(asset, {
              cache: "no-store",
              signal: AbortSignal.timeout(timeout),
            });
            await result.body?.cancel();
            return {
              status: result.status,
              cfRay: result.headers.get("cf-ray"),
            };
          },
          { asset: missingAsset, timeout: page.getDefaultTimeout() },
        );
        missingAssetStatus = oldAssetResponse.status;
        recordDiagnostic("recovery.old-asset.response", {
          url: missingAsset,
          ...oldAssetResponse,
        });
        expect(
          missingAssetStatus,
          `Old asset must be unavailable before recovery: ${missingAsset}`,
        ).toBe(404);
      }
      return true;
    });
    // An initialization error with available assets is a real failure, not a
    // reason to keep reloading until JavaScript happens to start successfully.
    await waitForHydration(page);
    console.log("[recovery test] Deployment conditions established:", {
      url,
      expectedClient,
      navigationAttempts: documents.length,
      missingAsset,
      missingAssetStatus,
    });
    return manifest;
  } catch (error) {
    const response = documents.at(-1);
    console.error("[recovery test] Deployment conditions were not established:", {
      url: page.url(),
      status: response?.status(),
      contentType: response?.headers()["content-type"],
      cfRay: response?.headers()["cf-ray"],
      navigationAttempts: documents.length,
      expectedClient,
      preloadUrls,
      missingAsset,
      missingAssetStatus,
      assetErrors,
      ...get(),
    });
    try {
      console.error(
        "[recovery test] Page text:",
        await page.evaluate(() => document.body?.innerText.slice(0, 2000)),
      );
    } catch (diagnosticError) {
      console.error(
        "[recovery test] Could not read page text:",
        diagnosticError,
      );
    }
    throw error;
  } finally {
    page.off("response", onResponse);
    page.off("requestfailed", onRequestFailed);
    page.off("pageerror", onPageError);
  }
}

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
    const initialManifest = await waitForDeployedBuild(page, projectDir, url);
    const { get } = trackPageErrors(page);
    await using probeContext = await browser.createBrowserContext();
    const probePage = await probeContext.newPage();

    // Sanity check: the home page loads.
    expect(await page.content()).toContain("Home");

    // context(chrsnymn, 30 Oct 2026): Keep a build-A tab open while a local
    // production redeploy changes the real NonDivWidget chunk hash. This
    // reproduces the deployment boundary without intercepting network traffic.
    const nonDivContext = await browser.createBrowserContext();
    try {
      const nonDivPage = await nonDivContext.newPage();
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

      await waitForDeployedBuild(nonDivPage, projectDir, url);
      const { get: getNonDivErrors } = trackPageErrors(nonDivPage);
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
      await waitForDeployedBuild(
        probePage,
        projectDir,
        new URL("/non-div-widget", url).href,
        new URL(initialManifest["src/app/pages/NonDivWidget.tsx"].file, url).href,
      );

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
    await waitForDeployedBuild(
      probePage,
      projectDir,
      new URL("/widget", url).href,
      new URL(initialManifest["src/app/pages/Widget.tsx"].file, url).href,
    );

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
    const intermediateManifest = await waitForDeployedBuild(page, projectDir, url);
    expect(Object.keys(intermediateManifest)).not.toContain(
      "src/app/pages/NewWidget.tsx",
    );
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
    await waitForDeployedBuild(
      probePage,
      projectDir,
      new URL("/widget", url).href,
      new URL(intermediateManifest["src/client.tsx"].file, url).href,
    );

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
