import { writeFile } from "fs/promises";
import { join } from "path";
import {
  createDevServer,
  poll,
  setupPlaygroundEnvironment,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  autoStartDevServer: false,
  deploy: false,
});

const HOME_PATH = "src/app/pages/Home.tsx";

const homeWithoutVendorClient = `import { AppButton, appClientUtil } from "../lib/client-utils.js";
import { PackageServerComponent } from "ui-lib/server";

export const Home = () => {
  console.log("#### appClientUtil", appClientUtil);
  const messageFromAppClientUtil = appClientUtil.format("Home Page");

  return (
    <div>
      <h1>Home</h1>
      <h2>Message from App Client Util (Scenario 1)</h2>
      <p id="message-from-app-util">{messageFromAppClientUtil}</p>
      <AppButton />

      <hr />

      <h2>Rendered Package Server Component (Scenario 3)</h2>
      <PackageServerComponent />
    </div>
  );
};
`;

const homeWithVendorClient = `import { AppButton, appClientUtil } from "../lib/client-utils.js";
import { PackageButton, packageClientUtil } from "ui-lib/client";
import { PackageServerComponent } from "ui-lib/server";

export const Home = () => {
  console.log("#### appClientUtil", appClientUtil);
  console.log("#### packageClientUtil", packageClientUtil);
  const messageFromAppClientUtil = appClientUtil.format("Home Page");
  const messageFromPackageClientUtil = packageClientUtil.format("Home Page");

  return (
    <div>
      <h1>Home</h1>
      <h2>Message from App Client Util (Scenario 1)</h2>
      <p id="message-from-app-util">{messageFromAppClientUtil}</p>
      <AppButton />

      <hr />

      <h2>Message from Package Client Util (Scenario 2)</h2>
      <p id="message-from-package-util">{messageFromPackageClientUtil}</p>
      <PackageButton />

      <hr />

      <h2>Rendered Package Server Component (Scenario 3)</h2>
      <PackageServerComponent />
    </div>
  );
};
`;

testSDK.dev(
  "recovers when a node_modules 'use client' module is added mid-session",
  async ({ page, projectDir }) => {
    // 1. Start the dev server without any node_modules "use client" imports.
    //    This leaves the client vendor barrel empty, matching the condition
    //    that previously caused Vite to cache an empty prebundle.
    await writeFile(join(projectDir, HOME_PATH), homeWithoutVendorClient);

    const devServerControl = createDevServer();
    const { url } = await devServerControl.start();

    await page.goto(url);
    await waitForHydration(page);

    // 2. Assert the node_modules client component is absent initially.
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).not.toContain("Message from Package Client Util");
      expect(textContent).not.toContain("Package Button clicks");
      return true;
    });

    // 3. Add the node_modules "use client" import mid-session.
    await writeFile(join(projectDir, HOME_PATH), homeWithVendorClient);

    // Give Vite a moment to detect the change, then reload so the worker
    // entry and client bundle pick up the new node_modules directive module.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.reload();
    await waitForHydration(page);

    // 4. Assert the node_modules client component is now rendered correctly.
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Message from Package Client Util");
      expect(textContent).toContain("Hello from the package, Home Page!");
      expect(textContent).toContain("Package Button clicks: 0");
      return true;
    });
  },
);
