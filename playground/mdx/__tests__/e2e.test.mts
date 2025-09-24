import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders MDX and client component", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("Hello world");
    return true;
  });

  const button = await page.waitForSelector("button");
  expect(button).not.toBeNull();

  let buttonText = await page.evaluate((el) => el?.textContent, button);
  expect(buttonText).toBe("Clicks: 0");

  await button?.click();

  await poll(async () => {
    buttonText = await page.evaluate((el) => el?.textContent, button);
    console.log("###", buttonText);
    expect(buttonText).toBe("Clicks: 1");
    return true;
  });
});
