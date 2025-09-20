import { test, expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  createDevServer,
  createDeployment,
  createBrowser,
  poll,
} from "rwsdk/e2e";

setupPlaygroundEnvironment();

test("renders Hello World on dev server", async () => {
  const devServer = await createDevServer();
  const browser = await createBrowser();
  const page = await browser.newPage();

  await page.goto(devServer.url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});

test("renders Hello World on deployment", async () => {
  const deployment = await createDeployment();
  const browser = await createBrowser();
  const page = await browser.newPage();

  await page.goto(deployment.url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});
