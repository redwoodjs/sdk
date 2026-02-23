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

  await page.click("#query-greeting");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe('"Hello, World! (from serverQuery GET)"');
    return true;
  });
});

testDevAndDeploy("serverQuery (POST) works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#query-greeting-post");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe('"Hello, World! (from serverQuery POST)"');
    return true;
  });
});

testDevAndDeploy("serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#action-update-name");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe('"Name updated to: Agent"');
    return true;
  });
});

testDevAndDeploy("default serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#action-default");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe('"Default action called!"');
    return true;
  });
});

testDevAndDeploy("query redirect works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#query-greeting-redirect");

  await poll(async () => {
    expect(page.url()).toBe(new URL("/redirect-success", url).toString());
    const text = await page.$eval("h2", (el) => el.textContent);
    expect(text).toBe("Redirect Successful!");
    return true;
  });
});

testDevAndDeploy("query error response works (dev)", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#query-greeting-error");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toMatch(/Caught Error/);
    return true;
  });
});

testDevAndDeploy("action error response works (dev)", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#action-update-name-error");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toMatch(/Caught Error/);
    return true;
  });
});
