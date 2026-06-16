import fs from "fs-extra";
import path from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDeploy(
  "recovers from WebSocket disconnect after redeploy",
  async ({ page, url, deployment, projectDir }) => {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(page);

    // Wait for the initial WebSocket connection to establish.
    await poll(async () => {
      const text = await page.$eval(
        "[data-testid='connection-status']",
        (el) => el.textContent,
      );
      return text?.includes("Connected") ?? false;
    });

    // Change the build marker so the next deploy produces a different bundle.
    const homePath = path.join(projectDir, "src/app/pages/Home.tsx");
    const original = await fs.readFile(homePath, "utf-8");
    const buildB = original.replace("Build A", "Build B");
    await fs.writeFile(homePath, buildB);

    await deployment.redeploy();

    // The stale tab's RPC session breaks. The recovery flow should wait until
    // the page is loadable again, then reload so the user gets the new build.
    await poll(async () => {
      const content = await page.content();
      return content.includes("Build B");
    });

    // After recovery the page should reconnect.
    await poll(async () => {
      const text = await page.$eval(
        "[data-testid='connection-status']",
        (el) => el.textContent,
      );
      return text?.includes("Connected") ?? false;
    });
  },
);
