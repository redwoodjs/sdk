import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect, vi } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

vi.setConfig({ testTimeout: 300000 });

testDevAndDeploy("server decorators demo is visible", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getDemoTitle = () => page.$("text=Server Decorator Demo");

  await poll(async () => {
    const demoTitle = await getDemoTitle();
    
    expect(demoTitle).not.toBeNull();
    
    return true;
  });
});

testDevAndDeploy("server action with decorators works", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();
  const nameInputSelector = "#name-input";
  const getResultText = () =>
    page.$eval("#decorator-result", (el) => el.textContent).catch(() => null);

  await poll(async () => {
    const content = await getPageContent();
    
    expect(content).toContain("Server Decorator Demo");

    return true;
  });

  await waitForHydration(page);

  await poll(async () => (await page.$(nameInputSelector)) !== null);
  await page.type(nameInputSelector, "example");

  await poll(async () => (await page.$("#greet-button")) !== null);
  await page.click("#greet-button");

  await poll(async () => {
    const resultText = await getResultText();
    
    if (!resultText) {
      return false;
    }

    expect(resultText).toContain("[Decorated]");
    expect(resultText).toContain("[Transformed] Example");
    expect(resultText).toContain("Hello");
    
    return true;
  });
});
