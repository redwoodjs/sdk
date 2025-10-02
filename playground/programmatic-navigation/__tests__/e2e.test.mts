import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
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
