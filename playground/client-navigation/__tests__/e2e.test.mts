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
      expect(content).not.toContain("Hello World");
      return true;
    });

    expect(page.url()).toContain("/about");
  },
);

testDevAndDeploy(
  "renders a navigation preload link for /about in the head",
  async ({ page, url }) => {
    await page.goto(url);

    await waitForHydration(page);

    await page.waitForSelector('link[rel="preload"][href="/about"]');
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
    expect(content).not.toContain("Hello World");
    return true;
  });

  expect(page.url()).toContain("/about");
});

testDevAndDeploy(
  "supports repeated navigations and browser back/forward",
  async ({ page, url }) => {
    await page.goto(url);

    await waitForHydration(page);

    const getPageContent = () => page.content();

    // Navigate to about via link click
    await page.click("#about-link");

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("About Page");
      expect(content).not.toContain("Hello World");
      return true;
    });

    // Navigate back
    await page.goBack();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Hello World");
      expect(content).not.toContain("About Page");
      return true;
    });

    // Navigate forward again
    await page.goForward();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("About Page");
      expect(content).not.toContain("Hello World");
      return true;
    });
  },
);
