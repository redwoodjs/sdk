import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "Chakra-UI comprehensive playground",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getElementText = (selector: string) =>
      page.$eval(selector, (el) => el.textContent);

    await poll(async () => {
      const mainTitle = await getElementText('[data-testid="main-title"]');
      expect(mainTitle).toContain("Chakra UI Playground");

      const subtitle = await getElementText('[data-testid="subtitle"]');
      expect(subtitle).toContain("Component showcase for RedwoodSDK with Chakra UI");

      const buttonTitle = await getElementText('#button');
      expect(buttonTitle).toContain("Button");

      const badgeTitle = await getElementText('#badge');
      expect(badgeTitle).toContain("Badge");

      const codeTitle = await getElementText('#code');
      expect(codeTitle).toContain("Code");

      const kbdTitle = await getElementText('#kbd');
      expect(kbdTitle).toContain("Keyboard");

      const accentButtonsCount = await page.$$eval('#button ~ div:nth-of-type(1) button', (nodes) => nodes.length);
      expect(accentButtonsCount).toBe(4);

      const colorSchemeButtons = await page.$$eval('#button ~ div:nth-of-type(1) button + * + * + * + * ~ * button', (nodes) =>
        nodes.map((n) => (n as HTMLButtonElement).textContent?.trim()),
      );
      expect(colorSchemeButtons).toContain("Blue");
      expect(colorSchemeButtons).toContain("Teal");
      expect(colorSchemeButtons).toContain("Pink");
      expect(colorSchemeButtons).toContain("Purple");

      await page.waitForSelector('[data-testid="button-solid"]');

      const badgeVariants = await page.$$eval('#badge ~ div:nth-of-type(1) span', (nodes) =>
        nodes.map((n) => n.textContent?.trim()),
      );
      expect(badgeVariants).toContain("solid");
      expect(badgeVariants).toContain("outline");
      expect(badgeVariants).toContain("subtle");

      const badgeSchemes = await page.$$eval('#badge ~ div:nth-of-type(1) + div span', (nodes) =>
        nodes.map((n) => n.textContent?.trim()),
      );
      expect(badgeSchemes).toContain("Success");
      expect(badgeSchemes).toContain("Error");
      expect(badgeSchemes).toContain("Info");
      expect(badgeSchemes).toContain("Warning");
      const badgeDefaultExists = await page.$('[data-testid="badge-default"]');
      expect(!!badgeDefaultExists).toBe(true);

      const codeVariantCount = await page.$$eval('#code ~ div:nth-of-type(1) code', (nodes) => nodes.length);
      expect(codeVariantCount).toBe(4);
      const pageContent = await page.content();
      expect(pageContent).toContain('const greeting = "Hello, World!"');
      expect(pageContent).toContain('function sum(a, b) { return a + b }');
      expect(pageContent).toContain('Error: undefined');

      const kbdShortcuts = await page.$$eval('#kbd ~ div:nth-of-type(1) kbd', (nodes) =>
        nodes.map((n) => n.textContent?.trim()),
      );
      expect(kbdShortcuts).toContain("⌘");
      expect(kbdShortcuts).toContain("C");
      expect(kbdShortcuts).toContain("Ctrl");
      expect(kbdShortcuts).toContain("V");
      expect(kbdShortcuts).toContain("Shift");
      expect(kbdShortcuts).toContain("Enter");

      const kbdSizeCount = await page.$$eval('#kbd ~ div:nth-of-type(1) + div kbd', (nodes) => nodes.length);
      expect(kbdSizeCount).toBe(3);
      return true;
    });

    const button = await page.waitForSelector('[data-testid="button-solid"]');
    await button?.click();
  },
);
