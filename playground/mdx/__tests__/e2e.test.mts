import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders MDX and client component", async ({ page, url }) => {
  await page.goto(url);

  const getButton = async () => await page.waitForSelector("button");

  const getButtonText = async () =>
    await page.evaluate((el) => el?.textContent, await getButton());

  const getPageContent = async () => await page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello world");
    expect(await getButtonText()).toBe("Clicks: 0");
    return true;
  });

  await page.waitForNetworkIdle();
  (await getButton())?.click();

  await poll(async () => {
    const buttonText = await getButtonText();
    expect(buttonText).toBe("Clicks: 1");
    return true;
  });
});
