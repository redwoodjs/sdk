import fs from "fs-extra";
import path from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  trackPageErrors,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDeploy(
  "recovers stale client modules after redeploy",
  async ({ page, url, deployment, projectDir }) => {
    if (!deployment) {
      throw new Error("Expected a deployment test environment");
    }

    const { get } = trackPageErrors(page);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    // Sanity check: the home page loads.
    expect(await page.content()).toContain("Home");

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

    const newWidgetPath = path.join(projectDir, "src/app/pages/NewWidget.tsx");
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
  },
);
