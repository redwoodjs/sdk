import { execSync } from "child_process";
import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

const playgroundDir = setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "handles todo list interactions correctly",
  async ({ page, url }) => {
    // Seed the database before running the test
    execSync("pnpm seed", { cwd: playgroundDir, stdio: "inherit" });

    await page.goto(url);
    await page.waitForFunction('document.readyState === "complete"');

    // Check for seeded data
    await expect(
      page.waitForSelector("text/Create a new playground example", {
        timeout: 5000,
      }),
    ).resolves.not.toBeNull();

    // Add a new todo
    const todoText = "Run the e2e tests";
    await page.fill('input[name="text"]', todoText);
    await page.click('button[type="submit"]');

    // Wait for the new todo to appear
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain(todoText);
      return true;
    });

    // Mark a todo as complete
    const checkboxSelector =
      ".todo-item:has-text('Write end-to-end tests') input[type='checkbox']";
    await page.click(checkboxSelector);

    // Wait for the completed class to be applied
    await poll(async () => {
      const element = await page.$(
        ".todo-item.completed:has-text('Write end-to-end tests')",
      );
      expect(element).not.toBeNull();
      return true;
    });
  },
);
