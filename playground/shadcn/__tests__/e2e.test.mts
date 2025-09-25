import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "shadcn/ui comprehensive playground",
  async ({ page, url }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} | ${request.failure()?.errorText}`);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(url);
    const getPageContent = () => page.content();

    // Verify initial render
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("shadcn/ui Comprehensive Playground");
      expect(content).toContain("47 Components");
      expect(content).toContain("React Server Components");

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

    // Wait for any async rendering to complete and check for errors
    await page.waitForNetworkIdle();
    expect({ consoleErrors, failedRequests }).toEqual({
      consoleErrors: [],
      failedRequests: [],
    });

    // Verify interactivity
    await waitForHydration(page);

    const getButtons = () => page.$$("button");
    const buttons = await getButtons();
    expect(buttons.length).toBeGreaterThan(0);
    if (buttons.length > 0) {
      await buttons[0].click();
    }

    const getEmailInputs = () => page.$$('input[type="email"]');
    const inputs = await getEmailInputs();
    if (inputs.length > 0) {
      await inputs[0].type("test@example.com");
      const value = await page.evaluate((el) => el.value, inputs[0]);
      expect(value).toBe("test@example.com");
    }

    // Final check for interaction-based errors
    expect({ consoleErrors, failedRequests }).toEqual({
      consoleErrors: [],
      failedRequests: [],
    });
  },
);
