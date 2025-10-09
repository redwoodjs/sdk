import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  poll,
  setupPlaygroundEnvironment,
  testDev,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDev("missing link directive scan", async ({ page, url, projectDir }) => {
  // Navigate to the missing link test page
  await page.goto(`${url}/missing-link`);

  await waitForHydration(page);

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
  const componentAPath = join(projectDir, "src/components/ComponentA.tsx");
  const originalContent = await readFile(componentAPath, "utf-8");

  // Uncomment the ComponentB import line
  const modifiedContent = originalContent
    .replace(
      '// import { ComponentB } from "./ComponentB";',
      'import { ComponentB } from "./ComponentB";',
    )
    .replace("{/* <ComponentB /> */}", "<ComponentB />");

  await writeFile(componentAPath, modifiedContent);

  // Verify the fix works. We poll here because HMR can take a moment
  // to pick up the file change and rebundle.
  await poll(async () => {
    const content = await getPageContent();

    // Check that all components are now rendered
    const hasAllComponents =
      content.includes("Component A (Server Component)") &&
      content.includes("Component B (Client Component)") &&
      content.includes("Component C (Client Component)");

    return hasAllComponents;
  });

  // Verify client-side interactivity works
  const clickIncrementButton = async () =>
    await page.evaluate(() => {
      const button = document.querySelector("button");
      if (button && button.textContent?.includes("Increment")) {
        button.click();
        return true;
      }
      return false;
    });

  await poll(async () => {
    const clicked = await clickIncrementButton();
    if (!clicked) return false;

    const content = await getPageContent();
    expect(content).toContain("Count: 1");
    return true;
  });
});
