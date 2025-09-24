import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

setupPlaygroundEnvironment(path.resolve(__dirname, "../packages/project"));

testDevAndDeploy("renders button from ui-lib", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("Hello from UI Lib");
  });
});
