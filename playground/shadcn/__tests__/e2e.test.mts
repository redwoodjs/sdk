import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders shadcn/ui comprehensive playground",
  async ({ page, url }) => {
    // Test home page
    await page.goto(url);
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("shadcn/ui Comprehensive Playground");
      expect(content).toContain("47 Components");
      expect(content).toContain("React Server Components");
      return true;
    });
  },
);

testDevAndDeploy(
  "renders all component sections on home page",
  async ({ page, url }) => {
    await page.goto(url);
    const getPageContent = () => page.content();

    // Verify initial render
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Basic UI Components");
      expect(content).toContain("Form Components");
      expect(content).toContain("Data Display");
      expect(content).toContain("Interactive Components");
      expect(content).toContain("Feedback Components");
      return true;
    });
  },
);

testDevAndDeploy(
  "all shadcn/ui components render without console errors",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} | ${request.failure()?.errorText}`);
    });

    // Capture console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Test home page with all components
    await page.goto(url);
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("All components rendered successfully");
      expect(content).toContain("Basic UI Components");
      expect(content).toContain("Form Components");
      return true;
    });

    // Wait a bit more for any async rendering to complete
    await page.waitForNetworkIdle();

    // Check that no console errors occurred
    expect({ consoleErrors, failedRequests }).toEqual({
      consoleErrors: [],
      failedRequests: [],
    });
  },
);

testDevAndDeploy(
  "shadcn/ui components are interactive",
  async ({ page, url }) => {
    await page.goto(url);
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Basic UI Components");
      return true;
    });

    await waitForHydration(page);

    // Test button interactions
    const getButtons = () => page.$$("button");
    const buttons = await getButtons();
    const buttonCount = buttons.length;
    expect(buttonCount).toBeGreaterThan(0);

    // Test that buttons are clickable (no errors thrown)
    if (buttonCount > 0) {
      await buttons[0].click();
    }

    // Test form inputs
    const getEmailInputs = () => page.$$('input[type="email"]');
    const inputs = await getEmailInputs();
    const inputCount = inputs.length;
    if (inputCount > 0) {
      await inputs[0].type("test@example.com");
      const value = await page.evaluate((el) => el.value, inputs[0]);
      expect(value).toBe("test@example.com");
    }
  },
);

testDevAndDeploy(
  "all component sections are present",
  async ({ page, url }) => {
    await page.goto(url);
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
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
      return true;
    });

    await page.waitForNetworkIdle();
  },
);

testDevAndDeploy(
  "specific shadcn/ui components render correctly",
  async ({ page, url }) => {
    await page.goto(url);
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Basic UI Components");
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
      return true;
    });
  },
);
