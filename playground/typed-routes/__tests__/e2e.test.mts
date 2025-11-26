import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders home page with typed routes",
  async ({ page, url }) => {
    await page.goto(url);

    await page.waitForFunction('document.readyState === "complete"');

    const getPageContent = async () => await page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Typed Routes Playground");
      expect(content).toContain("/");
      expect(content).toContain("/users/");
      expect(content).toContain("/files/");
      expect(content).toContain("/blog/");
      return true;
    });
  },
);

testDevAndDeploy("navigates to user profile page", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction('document.readyState === "complete"');

  // Wait for navigation link and click it
  await poll(async () => {
    const userLink = await page.$('a[href*="/users/"]');
    if (!userLink) return false;
    await userLink.click();
    return true;
  });

  // Wait for navigation
  await page.waitForFunction('document.readyState === "complete"');

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("User Profile");
    expect(content).toContain("123");
    return true;
  });
});

testDevAndDeploy("navigates to file viewer page", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction('document.readyState === "complete"');

  // Wait for file link and click it
  await poll(async () => {
    const fileLink = await page.$('a[href*="/files/"]');
    if (!fileLink) return false;
    await fileLink.click();
    return true;
  });

  // Wait for navigation
  await page.waitForFunction('document.readyState === "complete"');

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("File Viewer");
    expect(content).toContain("documents/readme.md");
    return true;
  });
});

testDevAndDeploy("navigates to blog post page", async ({ page, url }) => {
  await page.goto(url);
  await page.waitForFunction('document.readyState === "complete"');

  // Wait for blog link and click it
  await poll(async () => {
    const blogLink = await page.$('a[href*="/blog/"]');
    if (!blogLink) return false;
    await blogLink.click();
    return true;
  });

  // Wait for navigation
  await page.waitForFunction('document.readyState === "complete"');

  await poll(async () => {
    const content = await page.content();
    expect(content).toContain("Blog Post");
    expect(content).toContain("2024");
    expect(content).toContain("hello-world");
    return true;
  });
});
