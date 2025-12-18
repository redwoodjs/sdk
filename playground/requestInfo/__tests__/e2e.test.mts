import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  createDevServer,
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  testSDK,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  autoStartDevServer: false,
});

async function modifyFile(
  projectDir: string,
  filePath: string,
  replacements: [string | RegExp, string][],
) {
  const absolutePath = join(projectDir, filePath);
  let content = await readFile(absolutePath, "utf-8");

  for (const [search, replace] of replacements) {
    content = content.replace(search, replace);
  }

  await writeFile(absolutePath, content);
}

(SKIP_DEV_SERVER_TESTS ? testSDK.skip : testSDK)(
  "requestInfo state is preserved across HMR and works in server actions",
  async ({ page, projectDir }) => {
    // 1. Comment out all the dynamic parts of the app
    await modifyFile(projectDir, "src/components/ServerComponent.tsx", [
      ['import isEven from "is-even";', '//import isEven from "is-even";'],
      ['{isEven(2) ? "Yes" : "No"}', '{/* {isEven(2) ? "Yes" : "No"} */}'],
    ]);
    await modifyFile(projectDir, "src/app/pages/Home.tsx", [
      [
        'import { ServerComponent } from "../../components/ServerComponent";',
        '//import { ServerComponent } from "../../components/ServerComponent";',
      ],
      ["<ServerComponent />", "{/* <ServerComponent /> */}"],
      [
        'import { ClientComponent } from "../../components/ClientComponent";',
        '//import { ClientComponent } from "../../components/ClientComponent";',
      ],
      ["<ClientComponent />", "{/* <ClientComponent /> */}"],
    ]);
    await modifyFile(projectDir, "src/components/ClientComponent.tsx", [
      [
        'import isNumber from "is-number";',
        '//import isNumber from "is-number";',
      ],
      ['{isNumber(5) ? "Yes" : "No"}', '{/* {isNumber(5) ? "Yes" : "No"} */}'],
    ]);
    await modifyFile(projectDir, "src/app/actions.ts", [
      ['import isOdd from "is-odd";', '//import isOdd from "is-odd";'],
      [
        'return `Is 3 odd? ${isOdd(3) ? "Yes" : "No"}`',
        'return `Is 3 odd? ${/* isOdd(3) ? "Yes" : "No" */ ""}`',
      ],
    ]);

    // 2. Start the dev server
    const devServerControl = createDevServer();
    const { url } = await devServerControl.start();
    await page.goto(url);
    await waitForHydration(page);

    // 3. Initial page load assertion
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).not.toContain("Client Component");
      expect(textContent).not.toContain("Server Component");
      return true;
    });

    // 4. Uncomment ServerComponent and its dependency
    await modifyFile(projectDir, "src/components/ServerComponent.tsx", [
      ['//import isEven from "is-even";', 'import isEven from "is-even";'],
      ['{/* {isEven(2) ? "Yes" : "No"} */}', '{isEven(2) ? "Yes" : "No"}'],
    ]);
    await modifyFile(projectDir, "src/app/pages/Home.tsx", [
      [
        '//import { ServerComponent } from "../../components/ServerComponent";',
        'import { ServerComponent } from "../../components/ServerComponent";',
      ],
      ["{/* <ServerComponent /> */}", "<ServerComponent />"],
    ]);

    // 5. Assert ServerComponent is rendered
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Server Component");
      expect(textContent).toContain("Is 2 even? Yes");
      return true;
    });

    // 6. Uncomment ClientComponent and its dependency
    await modifyFile(projectDir, "src/components/ClientComponent.tsx", [
      [
        '//import isNumber from "is-number";',
        'import isNumber from "is-number";',
      ],
      ['{/* {isNumber(5) ? "Yes" : "No"} */}', '{isNumber(5) ? "Yes" : "No"}'],
    ]);
    await modifyFile(projectDir, "src/app/pages/Home.tsx", [
      [
        '//import { ClientComponent } from "../../components/ClientComponent";',
        'import { ClientComponent } from "../../components/ClientComponent";',
      ],
      ["{/* <ClientComponent /> */}", "<ClientComponent />"],
    ]);

    // 7. Assert ClientComponent is rendered
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Client Component");
      expect(textContent).toContain("Is 5 a number? Yes");
      return true;
    });

    // 8. Set up a listener to catch the server action response
    let serverActionSuccess = false;
    page.on("response", (response) => {
      if (response.headers()["x-server-action-success"] === "true") {
        serverActionSuccess = true;
      }
    });

    // 9. Uncomment server action dependency
    await modifyFile(projectDir, "src/app/actions.ts", [
      ['//import isOdd from "is-odd";', 'import isOdd from "is-odd";'],
      [
        'return `Is 3 odd? ${/* isOdd(3) ? "Yes" : "No" */ ""}`',
        'return `Is 3 odd? ${isOdd(3) ? "Yes" : "No"}`',
      ],
    ]);

    // 10. Assert that the server action result is displayed and state is preserved when the button is clicked
    await poll(async () => {
      // context(justinvdm, 21 Oct 2025): We need to retry the click because the
      // action's response will initially be a 307 because of the discovered
      // dependency causing a re-optimization to happen.
      const button = await page.waitForSelector("button");
      await button?.click();

      const textContent = await page.evaluate(() => document.body.innerText);

      const hasActionResult = textContent.includes(
        "Server action result: Is 3 odd? Yes",
      );
      expect(hasActionResult).toBe(true);
      expect(serverActionSuccess).toBe(true); // Header was received
      return true;
    });
  },
);

testDeploy(
  "requestInfo state is preserved and works in server actions in deployment",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    // 1. Assert all components are rendered on initial load
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Server Component");
      expect(textContent).toContain("Is 2 even? Yes");
      expect(textContent).toContain("Client Component");
      expect(textContent).toContain("Is 5 a number? Yes");
      return true;
    });

    // 2. Set up a listener to catch the server action response
    let serverActionSuccess = false;
    page.on("response", (response) => {
      if (response.headers()["x-server-action-success"] === "true") {
        serverActionSuccess = true;
      }
    });

    // 3. Click the button to call the server action
    const button = await page.waitForSelector("button");
    await button?.click();

    // 4. Assert that the server action result is displayed
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      const hasActionResult = textContent.includes(
        "Server action result: Is 3 odd? Yes",
      );
      expect(hasActionResult).toBe(true);
      expect(serverActionSuccess).toBe(true);
      return true;
    });
  },
);
