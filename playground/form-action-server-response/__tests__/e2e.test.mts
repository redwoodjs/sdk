import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  poll,
  waitForHydration,
} from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("form action increments server counter", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getCounterText = async () =>
    await page.evaluate(
      (el) => el?.textContent ?? "",
      await page.waitForSelector("#counter"),
    );

  await poll(async () => {
    expect(await getCounterText()).toContain("Counter: 0");
    return true;
  });

  // Submit the form
  const input = await page.waitForSelector("#name");
  await input?.type("Alice");
  const submit = await page.waitForSelector('button[type="submit"]');
  await submit?.click();

  // Expect counter increment after action completes and page re-renders
  await poll(async () => {
    const text = await getCounterText();
    expect(text).toContain("Counter: 1");
    return true;
  });
});

