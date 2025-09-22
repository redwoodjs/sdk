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

    await page.goto(url);

    // Wait for the main content to load
    await poll(async () => {
      const content = await page.content();
      return content.includes("Chakra UI Playground");
    });

    // Verify main title and subtitle
    await expect(page.getByTestId("main-title")).toContainText(
      "Chakra UI Playground",
    );
    await expect(page.getByTestId("subtitle")).toContainText(
      "Comprehensive component showcase for RedwoodSDK",
    );

    // Verify all section headings are present
    await expect(page.getByTestId("layout-section")).toContainText(
      "Layout Components",
    );
    await expect(page.getByTestId("form-section")).toContainText(
      "Form Components",
    );
    await expect(page.getByTestId("data-display-section")).toContainText(
      "Data Display Components",
    );
    await expect(page.getByTestId("feedback-section")).toContainText(
      "Feedback Components",
    );
    await expect(page.getByTestId("navigation-section")).toContainText(
      "Navigation Components",
    );
    await expect(page.getByTestId("overlay-section")).toContainText(
      "Overlay Components",
    );
    await expect(page.getByTestId("media-section")).toContainText(
      "Media Components",
    );
    await expect(page.getByTestId("typography-section")).toContainText(
      "Typography Components",
    );

    // Test key components from each category
    await expect(page.getByTestId("box-example")).toBeVisible();
    await expect(page.getByTestId("button-solid")).toBeVisible();
    await expect(page.getByTestId("badge-default")).toBeVisible();
    await expect(page.getByTestId("alert-success")).toBeVisible();
    await expect(page.getByTestId("breadcrumb-example")).toBeVisible();
    await expect(page.getByTestId("modal-trigger")).toBeVisible();
    await expect(page.getByTestId("avatar-name-only")).toBeVisible();
    await expect(page.getByTestId("heading-4xl")).toBeVisible();

    // Test some interactive functionality
    await page.getByTestId("toast-success-button").click();
    await expect(page.locator('[data-status="success"]')).toBeVisible();

    await page.getByTestId("modal-trigger").click();
    await expect(page.getByTestId("modal-example")).toBeVisible();
    await page.keyboard.press("Escape");

    // Verify no console errors occurred
    expect(consoleErrors).toHaveLength(0);
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

    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Chakra UI Playground");
    });

    // Test form interactions
    const textInput = page.getByTestId("basic-input").locator("input");
    await textInput.fill("Test input value");
    await expect(textInput).toHaveValue("Test input value");

    const checkbox = page.getByTestId("checkbox-single").locator("input");
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Test tabs functionality
    const tabsBasic = page.getByTestId("tabs-basic");
    await tabsBasic.locator('button:has-text("Two")').click();
    await expect(tabsBasic.locator("text=Panel Two")).toBeVisible();

    // Verify no console errors occurred during interactions
    expect(consoleErrors).toHaveLength(0);
  },
);
