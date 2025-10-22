import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Mantine components", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Mantine Playground");
    return true;
  });

  await page.waitForSelector('button:has-text("Open Dialog")');
  await page.waitForSelector('div[role="switch"]');
  await page.waitForSelector('div:has-text("Customization")');
});
