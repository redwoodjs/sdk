import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Base UI showcase without errors",
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

    // Check that no console errors occurred during initial load
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "accordion component renders and functions",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for accordion section to be present
    await poll(async () => {
      return await page
        .locator('[data-testid="accordion-section"]')
        .isVisible();
    });

    // Verify accordion is present
    const accordion = page.locator('[data-testid="accordion"]');
    await expect(accordion).toBeVisible();

    // Test accordion interaction
    const trigger = accordion.locator("button").first();
    await trigger.click();

    // Verify panel content appears
    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI is a library of headless UI components");
    });

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "dialog component renders and functions",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for dialog section
    await poll(async () => {
      return await page.locator('[data-testid="dialog-section"]').isVisible();
    });

    // Open dialog
    const dialogTrigger = page.locator('[data-testid="dialog-trigger"]');
    await dialogTrigger.click();

    // Verify dialog opens
    await poll(async () => {
      return await page.locator('[data-testid="dialog"]').isVisible();
    });

    const dialog = page.locator('[data-testid="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog content
    const content = await page.content();
    expect(content).toContain("Dialog Title");

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "alert dialog component renders and functions",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for alert dialog section
    await poll(async () => {
      return await page
        .locator('[data-testid="alert-dialog-section"]')
        .isVisible();
    });

    // Open alert dialog
    const alertTrigger = page.locator('[data-testid="alert-dialog-trigger"]');
    await alertTrigger.click();

    // Verify alert dialog opens
    await poll(async () => {
      return await page.locator('[data-testid="alert-dialog"]').isVisible();
    });

    const alertDialog = page.locator('[data-testid="alert-dialog"]');
    await expect(alertDialog).toBeVisible();

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "form components render and function",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Test checkbox
    await poll(async () => {
      return await page.locator('[data-testid="checkbox-section"]').isVisible();
    });

    const checkbox = page.locator('[data-testid="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    // Test input field
    await poll(async () => {
      return await page.locator('[data-testid="field-section"]').isVisible();
    });

    const input = page.locator('[data-testid="input"]');
    await expect(input).toBeVisible();
    await input.fill("test@example.com");

    // Test switch
    await poll(async () => {
      return await page.locator('[data-testid="switch-section"]').isVisible();
    });

    const switchComponent = page.locator('[data-testid="switch"]');
    await expect(switchComponent).toBeVisible();
    await switchComponent.click();

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "navigation components render and function",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Test tabs
    await poll(async () => {
      return await page.locator('[data-testid="tabs-section"]').isVisible();
    });

    const tabs = page.locator('[data-testid="tabs"]');
    await expect(tabs).toBeVisible();

    // Click on second tab
    const tab2 = tabs.locator("button").nth(1);
    await tab2.click();

    // Verify tab content changes
    await poll(async () => {
      const content = await page.content();
      return content.includes("Content for Tab 2");
    });

    // Test menu
    await poll(async () => {
      return await page.locator('[data-testid="menu-section"]').isVisible();
    });

    const menuTrigger = page.locator('[data-testid="menu-trigger"]');
    await menuTrigger.click();

    await poll(async () => {
      return await page.locator('[data-testid="menu"]').isVisible();
    });

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "interactive components render and function",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Test collapsible
    await poll(async () => {
      return await page
        .locator('[data-testid="collapsible-section"]')
        .isVisible();
    });

    const collapsibleTrigger = page.locator(
      '[data-testid="collapsible-trigger"]',
    );
    await collapsibleTrigger.click();

    await poll(async () => {
      return await page
        .locator('[data-testid="collapsible-panel"]')
        .isVisible();
    });

    // Test popover
    await poll(async () => {
      return await page.locator('[data-testid="popover-section"]').isVisible();
    });

    const popoverTrigger = page.locator('[data-testid="popover-trigger"]');
    await popoverTrigger.click();

    await poll(async () => {
      return await page.locator('[data-testid="popover"]').isVisible();
    });

    // Test tooltip (hover)
    await poll(async () => {
      return await page.locator('[data-testid="tooltip-section"]').isVisible();
    });

    const tooltipTrigger = page.locator('[data-testid="tooltip-trigger"]');
    await tooltipTrigger.hover();

    await poll(async () => {
      return await page.locator('[data-testid="tooltip"]').isVisible();
    });

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "all component sections are present",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // List of all component sections that should be present
    const expectedSections = [
      "accordion-section",
      "alert-dialog-section",
      "avatar-section",
      "checkbox-section",
      "checkbox-group-section",
      "collapsible-section",
      "dialog-section",
      "field-section",
      "menu-section",
      "number-field-section",
      "popover-section",
      "progress-section",
      "radio-section",
      "select-section",
      "separator-section",
      "slider-section",
      "switch-section",
      "tabs-section",
      "toggle-section",
      "toggle-group-section",
      "tooltip-section",
    ];

    // Wait for page to load
    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI Component Showcase");
    });

    // Check each section is present
    for (const sectionId of expectedSections) {
      await poll(async () => {
        return await page.locator(`[data-testid="${sectionId}"]`).isVisible();
      });

      const section = page.locator(`[data-testid="${sectionId}"]`);
      await expect(section).toBeVisible();
    }

    // Verify no console errors occurred
    expect(consoleErrors).toEqual([]);
  },
);
