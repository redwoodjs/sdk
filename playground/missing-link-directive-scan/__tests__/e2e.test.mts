import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy(
  "missing link directive scan fix",
  async ({ page, url, playgroundPath }) => {
    // Navigate to the missing link test page
    await page.goto(`${url}/missing-link`);

    // Wait for page to load
    await page.waitForFunction('document.readyState === "complete"');

    // Verify initial state - should show ComponentA only
    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Component A (Server Component)");
      expect(content).toContain("This is initially a server component");
      // Should NOT contain ComponentB or ComponentC initially
      expect(content).not.toContain("Component B (Client Component)");
      expect(content).not.toContain("Component C (Client Component)");
      return true;
    });

    // Now modify ComponentA.tsx to uncomment the ComponentB import
    const componentAPath = join(
      playgroundPath,
      "src/components/ComponentA.tsx",
    );
    const originalContent = readFileSync(componentAPath, "utf-8");

    // Uncomment the ComponentB import line
    const modifiedContent = originalContent
      .replace(
        '// import { ComponentB } from "./ComponentB";',
        'import { ComponentB } from "./ComponentB";',
      )
      .replace("// <ComponentB />", "<ComponentB />");

    writeFileSync(componentAPath, modifiedContent);

    // Wait a moment for HMR to process the change
    await page.waitForTimeout(1000);

    // Refresh the page to trigger the new import
    await page.reload();
    await page.waitForFunction('document.readyState === "complete"');

    // Verify the fix works - should now show all components without SSR errors
    await poll(async () => {
      const content = await getPageContent();

      // Should contain all components
      expect(content).toContain("Component A (Server Component)");
      expect(content).toContain("Component B (Client Component)");
      expect(content).toContain("Component C (Client Component)");

      // Should NOT contain SSR error messages
      expect(content).not.toContain("Internal server error");
      expect(content).not.toContain("No module found");
      expect(content).not.toContain("use client");

      return true;
    });

    // Verify client-side interactivity works
    const incrementButton = await page.waitForSelector(
      'button:has-text("Increment")',
    );
    await incrementButton.click();

    await poll(async () => {
      const countText = await page.textContent('p:has-text("Count:")');
      expect(countText).toContain("Count: 1");
      return true;
    });

    // Restore original file content
    writeFileSync(componentAPath, originalContent);
  },
);
