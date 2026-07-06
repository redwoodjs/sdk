import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders the my-ui-lib button", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("My UI Lib Button");
    return true;
  });

  // The host Vite transform should have run on the excluded node_modules file,
  // setting a global marker that the component reads into a data attribute.
  const content = await getPageContent();
  expect(content).toContain('data-host-transform="true"');
});
