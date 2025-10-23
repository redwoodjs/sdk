import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders CSS test case", async ({ page, url }) => {
  await page.goto(url);

  const element = await page.waitForSelector(".test-class");
  const color = await page.evaluate(
    (el) => getComputedStyle(el).color,
    element,
  );

  expect(color).toBe("rgb(0, 0, 255)");
});
