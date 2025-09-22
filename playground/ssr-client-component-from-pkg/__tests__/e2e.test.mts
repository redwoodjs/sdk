import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders a client component from a package",
  async ({ page, url }) => {
    await page.goto(url);

    // 1. Check for server-rendered content
    const heading = await page.locator("h1").textContent();
    expect(heading).toBe("SSR Client Component from Package");

    // 2. Check that the button is rendered with initial state
    const button = page.locator("button");
    await expect(button).toHaveText("Click Me (Clicks: 0)");

    // 3. Check for hydration errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // 4. Interact with the component
    await button.click();
    await button.click();

    // 5. Verify interactivity
    await expect(button).toHaveText("Click Me (Clicks: 2)");

    // 6. Assert that no hydration errors occurred
    expect(consoleErrors).toEqual([]);
  },
);
