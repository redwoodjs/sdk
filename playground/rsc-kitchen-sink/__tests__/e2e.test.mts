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
  const h1 = await page.$eval("h1[data-testid='h1']", (el) => el.textContent);
  expect(h1).toBe("RSC Kitchen Sink");

  // Check client component render
  const clientComponentHeader = await page.$eval("h2", (el) => el.textContent);
  expect(clientComponentHeader).toBe("Client Component");

  // Test form action
  const formResultSelector = "[data-testid='form-result']";
  let formResult = await page.$eval(formResultSelector, (el) => el.textContent);
  expect(formResult).toBe("");

  await page.type("input[name='text']", "Hello from test");
  await page.click("button[type='submit']");

  await poll(async () => {
    const result = await page.$eval(formResultSelector, (el) => el.textContent);
    return result === "Message from form action: Hello from test";
  });
  formResult = await page.$eval(formResultSelector, (el) => el.textContent);
  expect(formResult).toBe("Message from form action: Hello from test");

  // Test onClick action
  const onClickResultSelector = "[data-testid='onclick-result']";
  let onClickResult = await page.$eval(
    onClickResultSelector,
    (el) => el.textContent,
  );
  expect(onClickResult).toBe("");

  await page.click("button[data-testid='onclick-action-button']");

  await poll(async () => {
    const result = await page.$eval(
      onClickResultSelector,
      (el) => el.textContent,
    );
    return result?.startsWith("Message from onClick action at");
  });

  onClickResult = await page.$eval(
    onClickResultSelector,
    (el) => el.textContent,
  );
  expect(onClickResult).toMatch(/Message from onClick action at/);
});
