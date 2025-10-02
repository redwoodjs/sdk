import {
  $,
  poll,
  setupPlaygroundEnvironment,
  testDev,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDev(
  "seeds the database and displays initial todos",
  async ({ page, url, projectDir }) => {
    // Seed the database before running the test
    await $({ cwd: projectDir })`pnpm seed`;

    await page.goto(url);
    await waitForHydration(page);

    const getPageContent = () => page.content();

    // Check for seeded data
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Create a new playground example");
      expect(content).toContain("Write end-to-end tests");
      return true;
    });
  },
);

testDevAndDeploy(
  "allows adding and completing todos",
  async ({ page, url, projectDir }) => {
    // Seed the database to ensure a clean state
    await $({ cwd: projectDir })`pnpm seed`;

    await page.goto(url);
    await waitForHydration(page);

    // Helper functions
    const getTextInput = () => page.waitForSelector('input[name="text"]');
    const getSubmitButton = () => page.waitForSelector('button[type="submit"]');
    const getPageContent = () => page.content();
    const getTodoCheckbox = (text: string) =>
      page.waitForSelector(
        `.todo-item:has-text('${text}') input[type='checkbox']`,
      );

    // Add a new todo
    const todoText = "Run the e2e tests";
    await (await getTextInput())?.type(todoText);
    await (await getSubmitButton())?.click();

    // Wait for the new todo to appear
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain(todoText);
      return true;
    });

    // Mark a todo as complete
    const todoToComplete = "Write end-to-end tests";
    await (await getTodoCheckbox(todoToComplete))?.click();

    // Wait for the completed class to be applied
    await poll(async () => {
      const element = await page.$(
        `.todo-item.completed:has-text('${todoToComplete}')`,
      );
      expect(element).not.toBeNull();
      return true;
    });
  },
);
