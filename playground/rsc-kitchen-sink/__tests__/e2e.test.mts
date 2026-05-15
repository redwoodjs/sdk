import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("RSC Kitchen Sink", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();
  const getElementText = (selector: string) =>
    page.$eval(selector, (el) => el.textContent);
  const getLocation = () => page.url();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("RSC Kitchen Sink");

    // Check server component render
    const h1 = await getElementText("h1[data-testid='h1']");
    expect(h1).toBe("RSC Kitchen Sink");

    // Check client component render
    const clientComponentHeader = await getElementText("h2");
    expect(clientComponentHeader).toBe("Client Component");
    return true;
  });

  await waitForHydration(page);

  // Test form action
  const formResultSelector = "[data-testid='form-result']";
  const getFormResultText = () => getElementText(formResultSelector);

  await poll(async () => {
    const formResult = await getFormResultText();
    expect(formResult).toBe("");
    return true;
  });

  await page.type("input[name='text']", "Hello from test");
  await page.click("button[type='submit']");

  await poll(async () => {
    const result = await getFormResultText();
    expect(result).toBe("Message from form action: Hello from test");
    return true;
  });

  // Test onClick action
  const onClickResultSelector = "[data-testid='onclick-result']";
  const getOnClickResultText = () => getElementText(onClickResultSelector);

  await poll(async () => {
    const onClickResult = await getOnClickResultText();
    expect(onClickResult).toBe("");
    return true;
  });

  await page.click("button[data-testid='onclick-action-button']");

  await poll(async () => {
    const result = await getOnClickResultText();
    expect(result).toMatch(/Message from onClick action at/);
    return true;
  });

  // Test redirect action
  const redirectStatusSelector = "[data-testid='redirect-status']";
  const getRedirectStatusText = () => getElementText(redirectStatusSelector);

  // Initially, no redirect status should be shown
  await poll(async () => {
    const redirectStatus = await getRedirectStatusText();
    expect(redirectStatus).toBe("");
    return true;
  });

  // Track console logs to verify the onActionResponse hook was called
  const logs: string[] = [];
  const consoleHandler = (msg: any) => logs.push(msg.text());
  page.on("console", consoleHandler);

  // Click the redirect button and wait for navigation
  await Promise.all([
    page.waitForNavigation(),
    page.click("button[data-testid='redirect-action-button']"),
  ]);

  // Verify the hook was called by checking logs
  expect(
    logs.some((l) =>
      l.includes("[rsc-kitchen-sink] Intercepted action response"),
    ),
  ).toBe(true);
  expect(
    logs.some((l) =>
      l.includes("[rsc-kitchen-sink] Action requested a redirect to:"),
    ),
  ).toBe(true);

  // Verify we were redirected to the about page
  let currentUrl = await getLocation();
  expect(currentUrl).toContain("/about");

  // The page content should now show the About page
  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("About Page");
    return true;
  });

  // Go back home to test form redirect
  await page.click("a[href='/']");
  await waitForHydration(page);

  // Test form redirect action
  await Promise.all([
    page.waitForNavigation(),
    page.click("button[data-testid='form-redirect-button']"),
  ]);

  // Verify we were redirected to the about page with query param
  currentUrl = await getLocation();
  expect(currentUrl).toContain("/about?fromForm=true");

  // The page content should now show the About page
  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("About Page");
    return true;
  });
});
