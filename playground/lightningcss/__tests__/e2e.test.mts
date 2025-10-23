import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders CSS test case", async ({ page, url }) => {
  await page.goto(url);

  // TODO: Implement test
  expect(true).toBe(true);
});
