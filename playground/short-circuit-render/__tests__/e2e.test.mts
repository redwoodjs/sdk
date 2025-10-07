import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders the home page", async ({ page, url }) => {
  await page.goto(url);
  const content = await page.content();
  expect(content).toContain("Hello, world!");
});

testDevAndDeploy(
  "short-circuits render with a redirect",
  async ({ page, url }) => {
    const response = await page.goto(`${url}/short-circuit`);
    expect(response?.status()).toBe(302);

    // After the redirect, the page URL should be the home page
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/");
  },
);
