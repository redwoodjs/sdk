import { expect, test } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDev,
  poll,
  waitForHydration,
} from "rwsdk/e2e";
import { join } from "node:path";
import fs from "node:fs";

setupPlaygroundEnvironment(import.meta.url);

testDev("HMR for 'use client' directive", async ({ page, url, projectDir }) => {
  const clientToggleAddPath = join(
    projectDir,
    "src/app/components/ClientToggleAdd.tsx",
  );
  const clientToggleRemovePath = join(
    projectDir,
    "src/app/components/ClientToggleRemove.tsx",
  );

  await page.goto(url, { waitUntil: "networkidle0" });

  const originalClientToggleAdd = fs.readFileSync(clientToggleAddPath, "utf-8");
  const originalClientToggleRemove = fs.readFileSync(
    clientToggleRemovePath,
    "utf-8",
  );

  const getCount = async (selector: string): Promise<string> => {
    const element = await page.$(selector);
    const text = await page.evaluate((el) => el?.textContent, element);
    const match = text?.match(/Count: (\d+)/);
    return match?.[1] ?? "";
  };

  try {
    // `ClientToggleAdd` starts as a Server Component
    const addContainer = '[data-testid="client-toggle-add"]';
    const addButton = `${addContainer} button`;

    // Clicking does nothing because it's an RSC
    await page.click(addButton);
    expect(await getCount(addContainer)).toBe("0");

    // Add "use client"
    fs.writeFileSync(
      clientToggleAddPath,
      `"use client";\n${originalClientToggleAdd}`,
    );

    // Poll for the component to become interactive
    await poll(async () => {
      await page.click(addButton);
      return (await getCount(addContainer)) === "1";
    });

    // Now that it's a client component, test HMR for markup change
    const updatedClientToggleAdd = originalClientToggleAdd.replace(
      "Client Toggle Add",
      "Client Toggle Add HMR",
    );
    fs.writeFileSync(
      clientToggleAddPath,
      `"use client";
${updatedClientToggleAdd}`,
    );

    await poll(async () => {
      const content = await page.content();
      return content.includes("Client Toggle Add HMR");
    });

    // `ClientToggleRemove` starts as a Client Component
    const removeContainer = '[data-testid="client-toggle-remove"]';
    const removeButton = `${removeContainer} button`;

    await waitForHydration(page);

    // It should be interactive
    await page.click(removeButton);
    expect(await getCount(removeContainer)).toBe("1");

    // Remove "use client"
    fs.writeFileSync(
      clientToggleRemovePath,
      originalClientToggleRemove.replace(/"use client";\s*\n/, ""),
    );

    // Poll for the component to become a Server Component (resets count to 0)
    await poll(async () => {
      return (await getCount(removeContainer)) === "0";
    });

    // Clicking does nothing
    await page.click(removeButton);
    expect(await getCount(removeContainer)).toBe("0");

    // Now that it is a server component again, test HMR for markup change
    const updatedClientToggleRemove = originalClientToggleRemove.replace(
      "Client Toggle Remove",
      "Client Toggle Remove HMR",
    );
    fs.writeFileSync(
      clientToggleRemovePath,
      updatedClientToggleRemove.replace(/"use client";\s*\n/, ""),
    );

    await poll(async () => {
      const content = await page.content();
      return content.includes("Client Toggle Remove HMR");
    });
  } finally {
    fs.writeFileSync(clientToggleAddPath, originalClientToggleAdd);
    fs.writeFileSync(clientToggleRemovePath, originalClientToggleRemove);
  }
});

testDev("HMR for 'use server' directive", async ({ page, url, projectDir }) => {
  const serverActionFormPath = join(
    projectDir,
    "src/app/components/ServerActionForm.tsx",
  );

  const actionsPath = join(projectDir, "src/app/actions.ts");

  await page.goto(url, { waitUntil: "networkidle0" });

  const originalServerActionForm = fs.readFileSync(
    serverActionFormPath,
    "utf-8",
  );
  const originalActions = fs.readFileSync(actionsPath, "utf-8");

  const form = '[data-testid="server-action-form"]';
  const submitButton = `${form} button[type="submit"]`;
  const message = `${form} [data-testid="message"]`;

  try {
    // Initial state: form submission works
    await page.click(submitButton);
    await page.waitForSelector(message);
    const messageHandle = await page.$(message);
    expect(await page.evaluate((el) => el?.textContent, messageHandle)).toBe(
      "Hello, World!",
    );

    // Remove "use server" from the action
    fs.writeFileSync(
      actionsPath,
      originalActions.replace(/"use server";\s*\n/, ""),
    );

    // Poll for HMR update - expect an error because it's not a server action
    let consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    await poll(async () => {
      consoleErrors = [];
      await page.click(submitButton);
      await new Promise((resolve) => setTimeout(resolve, 100)); // give console time to report
      return consoleErrors.some((e) =>
        e.includes("Cannot read properties of undefined"),
      );
    });

    // Add "use server" back and change the message
    const updatedActions = originalActions.replace(
      "Hello, World!",
      "Hello, HMR!",
    );
    fs.writeFileSync(actionsPath, updatedActions);

    // Poll for HMR update - expect the new message
    await poll(async () => {
      await page.click(submitButton);
      await page.waitForSelector(message);
      const messageHandle = await page.$(message);
      const text = await page.evaluate((el) => el?.textContent, messageHandle);
      return text === "Hello, HMR!";
    });
  } finally {
    fs.writeFileSync(serverActionFormPath, originalServerActionForm);
    fs.writeFileSync(actionsPath, originalActions);
  }
});
