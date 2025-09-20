import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevServer,
  testDeployment,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevServer("renders Hello World on dev server", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});

testDeployment("renders Hello World on deployment", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});
