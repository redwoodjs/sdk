import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders shadcn/ui comprehensive playground",
  async ({ page, url }) => {
    // Test home page
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("shadcn/ui Comprehensive Playground");
    });

    const content = await page.content();
    expect(content).toContain("shadcn/ui Comprehensive Playground");
    expect(content).toContain("47 Components");
    expect(content).toContain("React Server Components");
  },
);

testDevAndDeploy(
  "renders all component sections on home page",
  async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();
    expect(content).toContain("Basic UI Components");
    expect(content).toContain("Form Components");
    expect(content).toContain("Data Display");
    expect(content).toContain("Interactive Components");
    expect(content).toContain("Feedback Components");
  },
);

testDevAndDeploy(
  "all shadcn/ui components render without console errors",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];

    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Test home page with all components
    await page.goto(url);
    await poll(async () => {
      const content = await page.content();
      return content.includes("All components rendered successfully");
    });

    // Wait a bit more for any async rendering to complete
    await page.waitForLoadState("networkidle");

    const content = await page.content();
    expect(content).toContain("Basic UI Components");
    expect(content).toContain("Form Components");

    // Check that no console errors occurred
    expect(consoleErrors).toEqual([]);
  },
);

testDevAndDeploy(
  "shadcn/ui components are interactive",
  async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    // Test button interactions
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Test that buttons are clickable (no errors thrown)
    if (buttonCount > 0) {
      await buttons.first().click();
    }

    // Test form inputs
    const inputs = page.locator('input[type="email"]');
    const inputCount = await inputs.count();
    if (inputCount > 0) {
      await inputs.first().fill("test@example.com");
      const value = await inputs.first().inputValue();
      expect(value).toBe("test@example.com");
    }

    // Test checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    if (checkboxCount > 0) {
      await checkboxes.first().check();
      const isChecked = await checkboxes.first().isChecked();
      expect(isChecked).toBe(true);
    }
  },
);

testDevAndDeploy(
  "all component sections are present",
  async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();

    // Check all major component sections exist on home page
    const expectedSections = [
      "Basic UI Components",
      "Form Components",
      "Data Display",
      "Interactive Components",
      "Feedback Components",
    ];

    for (const section of expectedSections) {
      expect(content).toContain(section);
    }
  },
);

testDevAndDeploy(
  "specific shadcn/ui components render correctly",
  async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();

    // Check for specific component content
    expect(content).toContain("Default");
    expect(content).toContain("Secondary");
    expect(content).toContain("Enter your email");
    expect(content).toContain("Type your message here");
    expect(content).toContain("Progress: 60%");
    expect(content).toContain("John Doe");
    expect(content).toContain("Jane Smith");
    expect(content).toContain("Heads up!");
    expect(content).toContain("Success!");
    expect(content).toContain("Is it accessible?");
  },
);
