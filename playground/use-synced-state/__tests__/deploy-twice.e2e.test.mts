import { readFile, writeFile } from "fs/promises";
import { join } from "path";
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
});

testSDK.deploy(
  "successfully redeploys with changed source",
  async ({ page, projectDir }) => {
    const deploymentControl = createDeployment();

    // 1. Deploy build A and load the page.
    const deploymentA = await deploymentControl.start();
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

    // 2. Modify the source so build B is materially different.
    const documentPath = join(projectDir, "src/app/Document.tsx");
    const documentContent = await readFile(documentPath, "utf-8");
    await writeFile(
      documentPath,
      documentContent.replace(
        "<title>Synced State Test</title>",
        "<title>Synced State Test Build B</title>",
      ),
    );

    // 3. Redeploy build B to the same worker / preview URL.
    const deploymentB = await deploymentControl.redeploy();
    expect(deploymentB.url).toBe(deploymentA.url);

    // 4. Load build B in a fresh tab and verify the change is live.
    const buildBPage = await page.browser().newPage();
    await buildBPage.goto(deploymentB.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForHydration(buildBPage);

    await poll(async () => {
      const title = await buildBPage.evaluate(() => document.title);
      expect(title).toBe("Synced State Test Build B");
      return true;
    });

    await buildBPage.close();
  },
);
