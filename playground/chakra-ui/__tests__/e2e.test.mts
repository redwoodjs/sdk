import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Chakra UI playground without errors",
  async ({ page, url }) => {
    // Set up console error tracking
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: "networkidle0" });

    // Wait for the main content to load
    await page.waitForSelector('[data-testid="main-title"]');

    // Verify main title and subtitle
    const mainTitle = await page.$eval(
      '[data-testid="main-title"]',
      (el) => el.textContent,
    );
    expect(mainTitle).toContain("Chakra UI Playground");

    const subtitle = await page.$eval(
      '[data-testid="subtitle"]',
      (el) => el.textContent,
    );
    expect(subtitle).toContain(
      "Comprehensive component showcase for RedwoodSDK",
    );

    // Verify all section headings are present
    const expectedHeadings = [
      "Layout Components",
      "Form Components",
      "Data Display Components",
      "Feedback Components",
      "Navigation Components",
      "Overlay Components",
      "Media Components",
      "Typography Components",
    ];
    for (const heading of expectedHeadings) {
      await page.waitForSelector(`h2 ::-p-text(${heading})`);
    }

    // Test some interactive functionality
    await page.click('[data-testid="toast-success-button"]');
    await page.waitForSelector('[data-status="success"]');

    await page.click('[data-testid="modal-trigger"]');
    await page.waitForSelector('[data-testid="modal-example"]', {
      visible: true,
    });
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-testid="modal-example"]', {
      hidden: true,
    });

    // Verify no console errors occurred
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "interactive components work correctly",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="main-title"]');

    // Test form interactions
    const textInputSelector = '[data-testid="basic-input"] input';
    await page.waitForSelector(textInputSelector);
    await page.type(textInputSelector, "Test input value");
    const inputValue = await page.$eval(
      textInputSelector,
      (el) => (el as HTMLInputElement).value,
    );
    expect(inputValue).toBe("Test input value");

    const checkboxSelector = '[data-testid="checkbox-single"] input';
    await page.waitForSelector(checkboxSelector);
    await page.click(checkboxSelector);
    const isChecked = await page.$eval(
      checkboxSelector,
      (el) => (el as HTMLInputElement).checked,
    );
    expect(isChecked).toBe(true);

    // Test tabs functionality
    const tabsSelector = '[data-testid="tabs-basic"]';
    await page.waitForSelector(tabsSelector);
    await page.click(`${tabsSelector} button:nth-of-type(2)`);
    await page.waitForSelector("div ::-p-text(Panel Two)");

    // Verify no console errors occurred during interactions
    expect(consoleErrors).toEqual([]);
  },
);
