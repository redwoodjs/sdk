import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Base UI showcase page without errors",
  async ({ page, url }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for the page to load
    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI Component Showcase");
    });

    // Verify main title is present
    const content = await page.content();
    expect(content).toContain("Base UI Component Showcase");
    expect(content).toContain("RedwoodSDK SSR Working");

    // Check that no console errors occurred during initial load
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy("renders component sections", async ({ page, url }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(url);

  // Wait for page to load
  await poll(async () => {
    const content = await page.content();
    return content.includes("Base UI Component Showcase");
  });

  // Check that component sections are present
  const expectedSections = [
    "static-content",
    "accordion-section",
    "dialog-section",
    "form-section",
  ];

  for (const sectionId of expectedSections) {
    await poll(async () => {
      return await page.locator(`[data-testid="${sectionId}"]`).isVisible();
    });

    const section = page.locator(`[data-testid="${sectionId}"]`);
    await expect(section).toBeVisible();
  }

  // Verify no console errors occurred
  expect(consoleErrors).toEqual([]);
});
