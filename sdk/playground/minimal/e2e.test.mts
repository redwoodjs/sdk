import { expect } from "vitest";
import {
  testDevServer,
  testDeployment,
  poll,
} from "../../src/lib/e2e/testHarness.mjs";

testDevServer("renders Hello World on dev server", async ({ page, url }) => {
  await page.goto(url);

  // Poll for the content to appear (handles any async loading)
  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  // Make the assertion
  const content = await page.content();
  expect(content).toContain("Hello World");
});

testDeployment("renders Hello World on deployment", async ({ page, url }) => {
  await page.goto(url);

  // Poll for the content to appear
  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  // Make the assertion
  const content = await page.content();
  expect(content).toContain("Hello World");
});
