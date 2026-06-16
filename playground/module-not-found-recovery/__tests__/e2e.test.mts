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
  "reproduces dynamic module failure after redeploy",
  async ({ page, url, deployment, projectDir }) => {
    const { get } = trackPageErrors(page);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    // Sanity check: the home page loads.
    expect(await page.content()).toContain("Home");

    // Modify the Widget component so its client chunk hash changes on the
    // next deploy. The route still exists, but a stale tab's lookup map still
    // points to the old hashed chunk.
    const widgetPath = path.join(projectDir, "src/app/pages/Widget.tsx");
    const original = await fs.readFile(widgetPath, "utf-8");
    const buildB = original.replace("Widget build A", "Widget build B");
    await fs.writeFile(widgetPath, buildB);

    await deployment.redeploy();

    // The tab is still running build A. Navigate to /widget using the stale
    // client router; the RSC response loads but the corresponding client chunk
    // no longer exists. The recovery flow should detect the failure, wait until
    // /widget is loadable, and reload the page.
    await page.click("#link-to-widget");

    // Wait for the recovery reload to land on the new build.
    await poll(async () => {
      const content = await page.content();
      return content.includes("Widget build B");
    });

    expect(page.url()).toContain("/widget");

    // The missing chunk should appear as a failed network request before the
    // recovery reload completes.
    const { failedRequests } = get();
    expect(
      failedRequests.some((r) => r.includes("Widget")),
    ).toBe(true);
  },
);
