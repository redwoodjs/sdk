import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy(
  "programmatically navigates on button click",
  async ({ page, url }) => {
    await page.goto(url);

    await waitForHydration(page);

    await page.click("#navigate-to-about");

    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("About Page");
      return true;
    });

    expect(page.url()).toContain("/about");
  },
);

testDevAndDeploy("navigates on link click", async ({ page, url }) => {
  await page.goto(url);

  await waitForHydration(page);

  await page.click("#about-link");

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("About Page");
    return true;
  });

  expect(page.url()).toContain("/about");
});
