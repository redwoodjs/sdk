import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders xterm container", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const exists = await page.$("#xterm-container");
    expect(Boolean(exists)).toBe(true);
    return true;
  });
});
