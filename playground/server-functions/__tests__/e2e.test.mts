import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect, vi } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

vi.setConfig({ testTimeout: 300000 });

testDevAndDeploy("server functions demo is visible", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getDemoTitle = () => page.$("text=Server Functions Demo");

  await poll(async () => {
    const demoTitle = await getDemoTitle();
    expect(demoTitle).not.toBeNull();
    return true;
  });
});

testDevAndDeploy("serverQuery (GET) works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-get-greeting");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe("Hello, World! (from serverQuery GET)");
    return true;
  });
});

testDevAndDeploy("serverQuery (POST) works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-get-greeting-post");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe("Hello, World! (from serverQuery POST)");
    return true;
  });
});

testDevAndDeploy("serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-update-name");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe(
      '"Greeting updated to: Hello, New Name! (from serverAction POST)"',
    );
    return true;
  });
});
