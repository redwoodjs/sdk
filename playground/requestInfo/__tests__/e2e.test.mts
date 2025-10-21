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

  // Wait for HMR to apply
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

testDev(
  "requestInfo state is preserved across HMR and works in server actions",
  async ({ page, url, projectDir }) => {
    await page.goto(url);
    await waitForHydration(page);

    // 1. Initial page load assertion
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("<p>Render count: 1</p>");
      expect(content).not.toContain("<h2>Client Component</h2>");
      expect(content).not.toContain("<h2>Server Component</h2>");
      return true;
    });

    // 2. Uncomment ServerComponent and its dependency
    await uncommentFile(page, projectDir, "src/app/pages/Home.tsx", [
      [
        '// import { ServerComponent } from "../../components/ServerComponent";',
        'import { ServerComponent } from "../../components/ServerComponent";',
      ],
      ["{/* <ServerComponent /> */}", "<ServerComponent />"],
    ]);
    await uncommentFile(
      page,
      projectDir,
      "src/components/ServerComponent.tsx",
      [
        ['// import isEven from "is-even";', 'import isEven from "is-even";'],
        ['{/* {isEven(2) ? "Yes" : "No"} */}', '{isEven(2) ? "Yes" : "No"}'],
      ],
    );

    // 3. Assert ServerComponent is rendered
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("<h2>Server Component</h2>");
      expect(content).toContain("<p>Is 2 even? Yes</p>");
      return true;
    });

    // 4. Uncomment ClientComponent and its dependency
    await uncommentFile(page, projectDir, "src/app/pages/Home.tsx", [
      [
        '// import { ClientComponent } from "../../components/ClientComponent";',
        'import { ClientComponent } from "../../components/ClientComponent";',
      ],
      ["{/* <ClientComponent /> */}", "<ClientComponent />"],
    ]);
    await uncommentFile(
      page,
      projectDir,
      "src/components/ClientComponent.tsx",
      [
        [
          '// import isNumber from "is-number";',
          'import isNumber from "is-number";',
        ],
        [
          '{/* {isNumber(5) ? "Yes" : "No"} */}',
          '{isNumber(5) ? "Yes" : "No"}',
        ],
      ],
    );

    // 5. Assert ClientComponent is rendered
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("<h2>Client Component</h2>");
      expect(content).toContain("<p>Is 5 a number? Yes</p>");
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
      ['// import isOdd from "is-odd";', 'import isOdd from "is-odd";'],
      [
        'return `Is 3 odd? {/* ${isOdd(3) ? "Yes" : "No"} */}`',
        'return `Is 3 odd? ${isOdd(3) ? "Yes" : "No"}`',
      ],
    ]);

    // 8. Click the button to call the server action
    await page.click('button:has-text("Call Server Action")');

    // 9. Assert that the server action result is displayed and state is preserved
    await poll(async () => {
      const content = await page.content();
      const hasActionResult = content.includes(
        "Server action result: Is 3 odd? Yes",
      );
      expect(hasActionResult).toBe(true);
      expect(serverActionSuccess).toBe(true); // Header was received
      expect(content).toContain("<p>Render count: 1</p>"); // Should not re-increment
      return true;
    });
  },
);
