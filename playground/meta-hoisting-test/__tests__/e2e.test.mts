import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("hoists meta tags", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("<title>Hoisted Title</title>");
    expect(content).toContain(
      '<meta name="description" content="This is a hoisted description." />',
    );
    // This is the crucial check: ensure the tags are in the <head>
    expect(content).toMatch(/<head>.*<title>Hoisted Title<\/title>.*<\/head>/s);
    expect(content).toMatch(
      /<head>.*<meta name="description" content="This is a hoisted description." \/>.*<\/head>/s,
    );
    return true;
  });
});
