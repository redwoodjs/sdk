import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("OG image generation works", async ({ page, url }) => {
  await page.goto(`${url}/og`);

  await poll(async () => {
    const response = await page.goto(`${url}/og`);
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()["content-type"];
    expect(contentType).toContain("image");
    return true;
  });
});
