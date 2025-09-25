import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
  trackPageErrors,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("Chakra UI playground", async ({ page, url }) => {
  const errorTracker = trackPageErrors(page);

  await page.goto(url, { waitUntil: "networkidle0" });

  const getElementText = (selector: string) =>
    page.$eval(selector, (el) => el.textContent);

  await poll(async () => {
    // Verify main title and subtitle
    const mainTitle = await getElementText('[data-testid="main-title"]');
    expect(mainTitle).toContain("Chakra UI Playground");

    const subtitle = await getElementText('[data-testid="subtitle"]');
    expect(subtitle).toContain("Basic component showcase for RedwoodSDK");

      // Verify only the simple components section is present
      const headings = await page.$$eval("h2", (nodes) =>
        nodes.map((n) => n.textContent),
      );
      expect(headings).toContain("Simple Components");
      expect(headings.length).toBe(2); // Title and the one section

    // Test a key component
    await page.waitForSelector('[data-testid="button-solid"]');
    return true;
  });

  // Verify no console errors occurred on render
  expect(errorTracker.get().consoleErrors).toEqual([]);

  await waitForHydration(page);

  const getButton = () => page.waitForSelector('[data-testid="button-solid"]');

  // Test button is clickable
  (await getButton())?.click();

  // Verify no console errors occurred during interactions
  expect(errorTracker.get().consoleErrors).toEqual([]);
});
