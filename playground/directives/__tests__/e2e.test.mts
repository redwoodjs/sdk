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
  console.log("########## projectDir:", projectDir);
  console.log("########## 0");

  // Navigate to the missing link test page
  await page.goto(`${url}/missing-link`);
  console.log("########## 1");

  await waitForHydration(page);
  console.log("########## 2");

  // Verify initial state - should show ComponentA only
  const getPageContent = () => page.content();
  console.log("########## 3");

  await poll(async () => {
    console.log("########## 4");
    const content = await getPageContent();
    console.log("########## 5");
    expect(content).toContain("Component A (Server Component)");
    console.log("########## 6");
    expect(content).toContain("This is initially a server component");
    console.log("########## 7");
    // Should NOT contain ComponentB or ComponentC initially
    expect(content).not.toContain("Component B (Client Component)");
    console.log("########## 8");
    expect(content).not.toContain("Component C (Client Component)");
    console.log("########## 9");
    return true;
  });

  console.log("########## 10");
  // Now modify ComponentA.tsx to uncomment the ComponentB import
  const componentAPath = join(projectDir, "src/components/ComponentA.tsx");
  console.log("########## componentAPath:", componentAPath);
  console.log("########## 11");
  const originalContent = await readFile(componentAPath, "utf-8");
  console.log("########## 12");

  // Uncomment the ComponentB import line
  const modifiedContent = originalContent
    .replace(
      '// import { ComponentB } from "./ComponentB";',
      'import { ComponentB } from "./ComponentB";',
    )
    .replace("{/* <ComponentB /> */}", "<ComponentB />");

  console.log("########## 13");
  await writeFile(componentAPath, modifiedContent);
  console.log("########## 14");

  // Verify the fix works. We poll here because HMR can take a moment
  // to pick up the file change and rebundle.
  await poll(async () => {
    console.log("########## 15");
    const content = await getPageContent();
    console.log("########## 16");

    // Check that all components are now rendered
    const hasAllComponents =
      content.includes("Component A (Server Component)") &&
      content.includes("Component B (Client Component)") &&
      content.includes("Component C (Client Component)");

    console.log("########## 17", hasAllComponents);
    return hasAllComponents;
  });

  console.log("########## 18");
  // Verify client-side interactivity works
  const incrementButton = await page.waitForSelector(
    'button:has-text("Increment")',
  );
  console.log("########## 19");
  await incrementButton?.click();
  console.log("########## 20");

  await poll(async () => {
    console.log("########## 21");
    const countText = await page.evaluate(() => {
      console.log("########## 22");
      const element = document.querySelector('p:has-text("Count:")');
      console.log("########## 23");
      return element?.textContent;
    });
    console.log("########## 24");
    expect(countText).toContain("Count: 1");
    console.log("########## 25");
    return true;
  });

  console.log("########## 26");
});
