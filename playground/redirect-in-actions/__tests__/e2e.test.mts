import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders redirect demo page", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Redirect in Actions");
    expect(content).toContain("Form Action Redirect");
    expect(content).toContain("onClick Action Redirect");
    return true;
  });
});

testDevAndDeploy(
  "form action redirects to success page with name",
  async ({ page, url }) => {
    await page.goto(url);

    const getNameInput = () =>
      page.waitForSelector('[data-testid="name-input"]');
    const getSubmitButton = () =>
      page.waitForSelector('[data-testid="form-submit"]');
    const getPageContent = () => page.content();

    await waitForHydration(page);

    await (await getNameInput())?.type("Test User");
    await (await getSubmitButton())?.click();

    await poll(async () => {
      const currentUrl = page.url();
      expect(currentUrl).toContain("/success");
      expect(currentUrl).toContain("from=form");
      expect(currentUrl).toContain("name=Test%20User");

      const content = await getPageContent();
      expect(content).toContain("Success!");
      expect(content).toContain("Redirected from: form");
      expect(content).toContain("Name submitted: Test User");
      return true;
    });
  },
);

testDevAndDeploy(
  "form action shows error when name is missing",
  async ({ page, url }) => {
    await page.goto(url);

    const getSubmitButton = () =>
      page.waitForSelector('[data-testid="form-submit"]');
    const getPageContent = () => page.content();
    const getFormError = () =>
      page.waitForSelector('[data-testid="form-error"]');

    await waitForHydration(page);

    await (await getSubmitButton())?.click();

    await poll(async () => {
      const errorElement = await getFormError();
      expect(errorElement).toBeTruthy();
      const errorText = await page.evaluate(
        (el) => el?.textContent,
        errorElement,
      );
      expect(errorText).toContain("Name is required");

      const content = await getPageContent();
      expect(content).toContain("Redirect in Actions");
      return true;
    });
  },
);

testDevAndDeploy(
  "onClick action redirects to success page",
  async ({ page, url }) => {
    await page.goto(url);

    const getOnClickButton = () =>
      page.waitForSelector('[data-testid="onclick-redirect-button"]');
    const getPageContent = () => page.content();

    await waitForHydration(page);

    await (await getOnClickButton())?.click();

    await poll(async () => {
      const currentUrl = page.url();
      expect(currentUrl).toContain("/success");
      expect(currentUrl).toContain("from=onclick");

      const content = await getPageContent();
      expect(content).toContain("Success!");
      expect(content).toContain("Redirected from: onclick");
      return true;
    });
  },
);
