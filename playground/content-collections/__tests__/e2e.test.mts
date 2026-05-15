import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders content from collections", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("<h1>Hello World</h1>");
    expect(content).toContain("<p>This is the first post.</p>");
    expect(content).toContain("This is the content of the first post.");
    return true;
  });
});
