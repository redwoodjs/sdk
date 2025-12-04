import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("WASM loading", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await poll(async () => {
    const textContent = await page.$eval(
      "#yoga-status",
      (el) => el.textContent,
    );
    expect(textContent).toBe("Yoga WASM module loaded successfully.");
    return true;
  });
});
