import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  monorepoRoot: path.resolve(__dirname, "../../.."),
});

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("Hello from UI Lib");
    return true;
  });
});
