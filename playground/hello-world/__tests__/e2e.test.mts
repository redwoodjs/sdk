import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

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

    // Wait for the page to be fully interactive
    await page.waitForFunction('document.readyState === "complete"');

    // Click the button to navigate
    await page.click("#navigate-to-about");

    const getPageContent = () => page.content();

    // Poll for the content of the new page
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("About Page");
      return true;
    });

    // Check the final URL
    expect(page.url()).toContain("/about");
  },
);

testDevAndDeploy(
  "programmatically navigates with smooth scroll",
  async ({ page, url }) => {
    // 1. Go to the home page
    await page.goto(url);
    await page.waitForFunction('document.readyState === "complete"');

    // 2. Navigate to the about page to have a long page to scroll
    await page.click("#navigate-to-about");
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("About Page");
      return true;
    });

    // 3. Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(500);

    // 4. Go back to the home page
    await page.goBack();
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("Hello World");
      return true;
    });

    // 5. Click the button to navigate with smooth scroll
    await page.click("#navigate-with-smooth-scroll");

    // 6. Wait for navigation and assert scroll position
    await poll(async () => {
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBe(0);
      return true;
    });
  },
);
