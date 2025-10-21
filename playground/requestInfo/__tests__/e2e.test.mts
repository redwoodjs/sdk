import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  type Page,
  poll,
  setupPlaygroundEnvironment,
  testDev,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

async function uncommentFile(
  page: Page,
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

testDev(
  "requestInfo state is preserved across HMR and works in server actions",
  async ({ page, url, projectDir }) => {
    await page.goto(url);
    await waitForHydration(page);

    // 1. Initial page load assertion
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).not.toContain("Client Component");
      expect(textContent).not.toContain("Server Component");
      return true;
    });

    // 2. Uncomment ServerComponent and its dependency
    await uncommentFile(
      page,
      projectDir,
      "src/components/ServerComponent.tsx",
      [
        ['//import isEven from "is-even";', 'import isEven from "is-even";'],
        ['{/* {isEven(2) ? "Yes" : "No"} */}', '{isEven(2) ? "Yes" : "No"}'],
      ],
    );
    await uncommentFile(page, projectDir, "src/app/pages/Home.tsx", [
      [
        '//import { ServerComponent } from "../../components/ServerComponent";',
        'import { ServerComponent } from "../../components/ServerComponent";',
      ],
      ["{/* <ServerComponent /> */}", "<ServerComponent />"],
    ]);

    // 3. Assert ServerComponent is rendered
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Server Component");
      expect(textContent).toContain("Is 2 even? Yes");
      return true;
    });

    // 4. Uncomment ClientComponent and its dependency
    await uncommentFile(
      page,
      projectDir,
      "src/components/ClientComponent.tsx",
      [
        [
          '//import isNumber from "is-number";',
          'import isNumber from "is-number";',
        ],
        [
          '{/* {isNumber(5) ? "Yes" : "No"} */}',
          '{isNumber(5) ? "Yes" : "No"}',
        ],
      ],
    );
    await uncommentFile(page, projectDir, "src/app/pages/Home.tsx", [
      [
        '//import { ClientComponent } from "../../components/ClientComponent";',
        'import { ClientComponent } from "../../components/ClientComponent";',
      ],
      ["{/* <ClientComponent /> */}", "<ClientComponent />"],
    ]);

    // 5. Assert ClientComponent is rendered
    await poll(async () => {
      const textContent = await page.evaluate(() => document.body.innerText);
      expect(textContent).toContain("Client Component");
      expect(textContent).toContain("Is 5 a number? Yes");
      return true;
    });

    // 6. Set up a listener to catch the server action response
    let serverActionSuccess = false;
    page.on("response", (response) => {
      if (response.headers()["x-server-action-success"] === "true") {
        serverActionSuccess = true;
      }
    });

    // 7. Uncomment server action dependency
    await uncommentFile(page, projectDir, "src/app/actions.ts", [
      ['//import isOdd from "is-odd";', 'import isOdd from "is-odd";'],
      [
        'return `Is 3 odd? ${/* isOdd(3) ? "Yes" : "No" */ ""}`',
        'return `Is 3 odd? ${isOdd(3) ? "Yes" : "No"}`',
      ],
    ]);

    const getButton = async () => page.waitForSelector("button");

    // 8. Assert that the server action result is displayed and state is preserved when the button is clicked
    await poll(async () => {
      // context(justinvdm, 21 Oct 2025): We need to retry the click because the
      // action's response will initially be a 307 because of the discovered
      // dependency causing a re-optimization to happen.
      (await getButton())?.click();

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
