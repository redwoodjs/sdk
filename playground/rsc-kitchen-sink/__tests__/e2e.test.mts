import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("RSC Kitchen Sink", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();
  const getElementText = (selector: string) =>
    page.$eval(selector, (el) => el.textContent);

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
});
