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
  async ({ page, devServer }) => {
    if (!devServer) {
      throw new Error("Dev server not available");
    }

    await $({ cwd: devServer.projectDir })`pnpm seed`;

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
  },
);
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

testDev(
  "migrates successfully when Cloudflare internal _cf_* tables are present",
  async ({ page, devServer }) => {
    if (!devServer) {
      throw new Error("Dev server not available");
    }

    // Trigger creation of Cloudflare internal _cf_* tables by calling
    // storage.put on the DO. This mimics what happens on the real platform
    // when alarms or KV storage are used. We do this BEFORE any database
    // query so that the DO is still uninitialized. When the next DB query
    // triggers initialize() → migrateToLatest(), the introspector must skip
    // _cf_* tables to avoid SQLITE_AUTH.
    const setupResponse = await fetch(
      new URL("/__test/setup-cf-tables", devServer.url),
    );
    expect(setupResponse.status).toBe(200);

    // Load the home page. This triggers the first DB query on this DO
    // instance, which calls initialize() → migrator.migrateToLatest() →
    // ensureMigrationTableExists() → getTables(). The introspector must
    // skip _cf_* tables to avoid SQLITE_AUTH.
    await page.goto(devServer.url);
    await waitForHydration(page);

    const getPageContent = () => page.content();

    // Verify the page loaded successfully (no migrations error).
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Todo List");
      return true;
    });
  },
);
