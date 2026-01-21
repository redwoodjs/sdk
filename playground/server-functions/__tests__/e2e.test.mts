import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect, vi } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

vi.setConfig({ testTimeout: 30000 });

testDevAndDeploy("server functions demo is visible", async ({ page, url }) => {
  await page.goto(url);

  // Wait for page to be fully interactive
  await page.waitForFunction("document.readyState === 'complete'");

  const getDemoTitle = () => page.$("text=Server Functions Demo");

  await poll(async () => {
    const demoTitle = await getDemoTitle();
    expect(demoTitle).not.toBeNull();
    return true;
  });
});

testDevAndDeploy("serverQuery (GET) works", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction("document.readyState === 'complete'");

  await page.click("#run-get-greeting");

  await poll(async () => {
    const result = await page.$eval("#server-function-result", (el) => el.textContent);
    expect(result).toBe("Hello, World! (from serverQuery GET)");
    return true;
  });
});

testDevAndDeploy("serverQuery (POST) works", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction("document.readyState === 'complete'");

  await page.click("#run-get-greeting-post");

  await poll(async () => {
    const result = await page.$eval("#server-function-result", (el) => el.textContent);
    expect(result).toBe("Hello, World! (from serverQuery POST)");
    return true;
  });
});

testDevAndDeploy("serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction("document.readyState === 'complete'");

  await page.click("#run-update-name");

  await poll(async () => {
    const result = await page.$eval("#server-function-result", (el) => el.textContent);
    expect(result).toBe('"Greeting updated to: Hello, New Name! (from serverAction POST)"');
    return true;
  });
});

testDevAndDeploy("default serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction("document.readyState === 'complete'");

  await page.click("#run-default-action");

  await poll(async () => {
    const result = await page.$eval("#server-function-result", (el) => el.textContent);
    expect(result).toBe("Default action called!");
    return true;
  });
});
