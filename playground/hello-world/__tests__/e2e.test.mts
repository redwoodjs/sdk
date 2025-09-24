import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});
