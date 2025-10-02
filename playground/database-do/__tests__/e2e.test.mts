import {
  $,
  createDevServer,
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testSDK("seeds the database and displays initial todos", async ({ page }) => {
  const devServerControl = createDevServer();

  await $({ cwd: devServerControl.projectDir })`pnpm seed`;

  const devServer = await devServerControl.start();

  await page.goto(devServer.url);
  await waitForHydration(page);

  const getPageContent = () => page.content();

  // Check for seeded data
  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Create a new playground example");
    expect(content).toContain("Write end-to-end tests");
    return true;
  });
});
testDevAndDeploy(
  "allows adding and completing todos",
  async ({ page, url }) => {
    console.log("###### goto", url);
    await page.goto(url);
    console.log("###### hydration");
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
    console.log("###### type", todoText);
    await (await getTextInput())?.type(todoText);
    console.log("###### click");
    await (await getSubmitButton())?.click();

    // Wait for the new todo to appear
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain(todoText);
      return true;
    });
  },
);
