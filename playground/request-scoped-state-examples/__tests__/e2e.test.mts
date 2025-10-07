import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("request-scoped state isolation", async ({ page, url }) => {
  const getServerRequestId = async () =>
    await page.evaluate(() => document.querySelector("p")?.textContent);
  const getServerCounterValue = async (index) =>
    await page.evaluate(
      (idx) => document.querySelectorAll("p")[idx]?.textContent,
      index,
    );
  const clickButton = async (text) =>
    await page.evaluate(
      (buttonText) =>
        Array.from(document.querySelectorAll("button"))
          .find((btn) => btn.textContent?.includes(buttonText))
          ?.click(),
      text,
    );
  const getClientCounterValue = async () =>
    await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("p")).find((p) =>
          p.textContent?.includes("Counter Value:"),
        )?.textContent,
    );

  page.goto(url);

  // Wait for page to load
  await poll(async () => {
    const requestId = await getServerRequestId();
    return requestId?.includes("Request ID:") ?? false;
  });

  // Check server-side counter values
  expect(await getServerCounterValue(2)).toContain("Initial Value: 0");
  expect(await getServerCounterValue(3)).toContain("After Increment: 1");
  expect(await getServerCounterValue(4)).toContain(
    "After Another Increment: 2",
  );
  expect(await getServerCounterValue(5)).toContain("After Decrement: 1");
  expect(await getServerCounterValue(6)).toContain("Final Value: 1");

  // Initialize client counter
  await clickButton("Initialize Counter");

  await poll(async () => {
    const counterValue = await getClientCounterValue();
    return counterValue?.includes("Counter Value: 0") ?? false;
  });

  // Test increment
  await clickButton("Increment");
  await poll(async () => {
    const counterValue = await getClientCounterValue();
    return counterValue?.includes("Counter Value: 1") ?? false;
  });

  // Test decrement
  await clickButton("Decrement");
  await poll(async () => {
    const counterValue = await getClientCounterValue();
    return counterValue?.includes("Counter Value: 0") ?? false;
  });

  // Test reset
  await clickButton("Reset");
  await poll(async () => {
    const counterValue = await getClientCounterValue();
    return counterValue?.includes("Counter Value: 0") ?? false;
  });
});
