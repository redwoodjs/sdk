import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders Base UI showcase with SSR and client hydration",
  async ({ page, url }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for the page to load (SSR content)
    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI Component Showcase");
    });

    // Verify SSR content is present
    const content = await page.content();
    expect(content).toContain("Base UI Component Showcase");
    expect(content).toContain("RedwoodSDK SSR Working");

    // Wait for client components to load
    await poll(
      async () => {
        return await page.locator('[data-testid="client-loading"]').isVisible();
      },
      { timeout: 10000 },
    );

    // Check that no console errors occurred during initial load and hydration
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "Base UI components render and function after hydration",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for client components to load
    await poll(
      async () => {
        return await page.locator('[data-testid="accordion-demo"]').isVisible();
      },
      { timeout: 15000 },
    );

    // Test Accordion
    const accordionTrigger = page.locator('[data-testid="accordion"] button');
    await accordionTrigger.click();

    await poll(async () => {
      const content = await page.content();
      return content.includes("Base UI is a library of headless UI components");
    });

    // Test Dialog
    const dialogTrigger = page.locator('[data-testid="dialog-trigger"]');
    await dialogTrigger.click();

    await poll(async () => {
      return await page.locator('[data-testid="dialog"]').isVisible();
    });

    // Test Switch
    const switchComponent = page.locator('[data-testid="switch"]');
    await switchComponent.click();

    // Test Toggle
    const toggle = page.locator('[data-testid="toggle"]');
    await toggle.click();

    // Test Input
    const input = page.locator('[data-testid="input"]');
    await input.fill("test@example.com");

    // Test Tabs
    const tab2 = page.locator('[data-testid="tabs"] button').nth(1);
    await tab2.click();

    await poll(async () => {
      const content = await page.content();
      return content.includes("Content for Tab 2");
    });

    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "all Base UI component demos are present",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for client components to load
    await poll(
      async () => {
        return await page.locator('[data-testid="client-loading"]').isVisible();
      },
      { timeout: 15000 },
    );

    // List of all component demos that should be present
    const expectedDemos = [
      "accordion-demo",
      "dialog-demo",
      "alert-dialog-demo",
      "avatar-demo",
      "input-demo",
      "switch-demo",
      "toggle-demo",
      "tabs-demo",
      "popover-demo",
      "tooltip-demo",
    ];

    // Check each demo is present
    for (const demoId of expectedDemos) {
      await poll(
        async () => {
          return await page.locator(`[data-testid="${demoId}"]`).isVisible();
        },
        { timeout: 5000 },
      );

      const demo = page.locator(`[data-testid="${demoId}"]`);
      await expect(demo).toBeVisible();
    }

    // Verify no console errors occurred
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "popover and tooltip interactions work",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);

    // Wait for client components to load
    await poll(
      async () => {
        return await page.locator('[data-testid="popover-demo"]').isVisible();
      },
      { timeout: 15000 },
    );

    // Test Popover
    const popoverTrigger = page.locator('[data-testid="popover-trigger"]');
    await popoverTrigger.click();

    await poll(async () => {
      return await page.locator('[data-testid="popover"]').isVisible();
    });

    // Test Tooltip (hover)
    const tooltipTrigger = page.locator('[data-testid="tooltip-trigger"]');
    await tooltipTrigger.hover();

    await poll(async () => {
      return await page.locator('[data-testid="tooltip"]').isVisible();
    });

    expect(consoleErrors).toEqual([]);
  },
);
