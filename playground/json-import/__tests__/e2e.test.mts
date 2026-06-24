import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders JSON from both server and client components",
  async ({ page, url }) => {
    await page.goto(url);

    await poll(async () => {
      const serverMessage = await page.$eval(
        "#server-json-message",
        (el) => el.textContent,
      );
      expect(serverMessage).toContain("Hello from a JSON file");
      return true;
    });

    await poll(async () => {
      const clientMessage = await page.$eval(
        "#client-json-message",
        (el) => el.textContent,
      );
      expect(clientMessage).toContain("Hello from a JSON file");
      return true;
    });

    const items = await page.$$eval("#server-json-items li", (els) =>
      els.map((el) => el.textContent),
    );
    expect(items).toEqual(["one", "two", "three"]);
  },
);

testDevAndDeploy("renders JSON imported with ?raw", async ({ page, url }) => {
  await page.goto(`${url}/raw`);

  await poll(async () => {
    const rawJson = await page.$eval("#raw-json", (el) => el.textContent);
    expect(rawJson).toContain('"greeting": "Hello from a JSON file"');
    return true;
  });
});
