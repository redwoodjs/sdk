import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("request-scoped state isolation", async ({ page, url }) => {
  await page.goto(`${url}/counter`);
  await page.waitForFunction('document.readyState === "complete"');

  // Wait for the page to load
  await page.waitForSelector("h2");

  // Check that server-side counter is working
  const serverRequestId = await page.$eval("p", (el) => el.textContent);
  expect(serverRequestId).toContain("Request ID:");

  // Check that server-side counter values are displayed
  const initialValue = await page.$eval(
    "p:nth-of-type(3)",
    (el) => el.textContent,
  );
  expect(initialValue).toContain("Initial Value: 0");

  const afterIncrement = await page.$eval(
    "p:nth-of-type(4)",
    (el) => el.textContent,
  );
  expect(afterIncrement).toContain("After Increment: 1");

  const afterAnotherIncrement = await page.$eval(
    "p:nth-of-type(5)",
    (el) => el.textContent,
  );
  expect(afterAnotherIncrement).toContain("After Another Increment: 2");

  const afterDecrement = await page.$eval(
    "p:nth-of-type(6)",
    (el) => el.textContent,
  );
  expect(afterDecrement).toContain("After Decrement: 1");

  const finalValue = await page.$eval(
    "p:nth-of-type(7)",
    (el) => el.textContent,
  );
  expect(finalValue).toContain("Final Value: 1");
});
