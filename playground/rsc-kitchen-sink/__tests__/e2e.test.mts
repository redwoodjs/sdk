import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("RSC Kitchen Sink", async ({ page, url }) => {
  await page.goto(url);

  // Wait for hydration and initial render
  await poll(async () => {
    const content = await page.content();
    return content.includes("RSC Kitchen Sink");
  });

  // Check server component render
  const h1 = await page.textContent("h1[data-testid='h1']");
  expect(h1).toBe("RSC Kitchen Sink");

  // Check client component render
  const clientComponentHeader = await page.textContent("h2");
  expect(clientComponentHeader).toBe("Client Component");

  // Test form action
  const formResultSelector = "[data-testid='form-result']";
  let formResult = await page.textContent(formResultSelector);
  expect(formResult).toBe("");

  await page.fill("input[name='text']", "Hello from test");
  await page.click("button[type='submit']");

  await poll(async () => {
    const result = await page.textContent(formResultSelector);
    return result === "Message from form action: Hello from test";
  });
  formResult = await page.textContent(formResultSelector);
  expect(formResult).toBe("Message from form action: Hello from test");

  // Test onClick action
  const onClickResultSelector = "[data-testid='onclick-result']";
  let onClickResult = await page.textContent(onClickResultSelector);
  expect(onClickResult).toBe("");

  await page.click("button:has-text('Execute onClick Action')");

  await poll(async () => {
    const result = await page.textContent(onClickResultSelector);
    return result?.startsWith("Message from onClick action at");
  });

  onClickResult = await page.textContent(onClickResultSelector);
  expect(onClickResult).toMatch(/Message from onClick action at/);
});
