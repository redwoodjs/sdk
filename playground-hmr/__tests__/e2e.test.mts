import fs from "node:fs";

const playgroundPath = setupPlaygroundEnvironment(import.meta.url);

const clientToggleAddPath = join(
  playgroundPath,
  "src/app/client-toggle-add.ts",
);
const clientToggleRemovePath = join(
  playgroundPath,
  "src/app/client-toggle-remove.ts",
);
const actionsPath = join(playgroundPath, "src/app/actions.ts");

testDev("HMR for 'use client' directive", async ({ page, url }) => {
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

    await waitForHydration(page);

    // Clicking does nothing because it's an RSC
    await page.click(addButton);
    expect(await getCount(addContainer)).toBe("0");

    // Add "use client"
    const form = '[data-testid="client-toggle-add-form"]';
    const submitButton = `${form} button[type="submit"]`;
    const message = `${form} [data-testid="message"]`;

    await page.click(submitButton);
    await page.waitForSelector(message);
    const messageHandle = await page.$(message);
    expect(await page.evaluate((el) => el?.textContent, messageHandle)).toBe(
      "Hello, World!",
    );

    // Remove "use client"
    const removeContainer = '[data-testid="client-toggle-remove"]';
    const removeButton = `${removeContainer} button`;

    await waitForHydration(page);

    // It should be interactive
    await page.click(removeButton);
    expect(await getCount(removeContainer)).toBe("1");
  } catch (e) {
    console.error("Test failed:", e);
    expect(e).toBe(null);
  }
});

testDev("HMR for server actions", async ({ page, url }) => {
  await page.goto(url, { waitUntil: "networkidle0" });

  const originalActions = fs.readFileSync(actionsPath, "utf-8");

  try {
    // Initial state: form submission works
    const form = '[data-testid="actions-form"]';
    const submitButton = `${form} button[type="submit"]`;
    const message = `${form} [data-testid="message"]`;

    await page.click(submitButton);
    await page.waitForSelector(message);
    const messageHandle = await page.$(message);
    expect(await page.evaluate((el) => el?.textContent, messageHandle)).toBe(
      "Hello, World!",
    );

    // Comment out the server action import
    fs.writeFileSync(
      actionsPath,
      originalActions.replace(
        "export const actions = {",
        "// export const actions = {",
      ),
    );

    // HMR should re-import the new file
    await page.reload();
    await page.waitForSelector(message);
    expect(await page.evaluate((el) => el?.textContent, messageHandle)).toBe(
      "Hello, World!",
    );
  } catch (e) {
    console.error("Test failed:", e);
    expect(e).toBe(null);
  }
});
