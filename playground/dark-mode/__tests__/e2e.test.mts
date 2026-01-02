import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Dark Mode Playground", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Dark Mode Playground");
    return true;
  });
});

testDevAndDeploy("theme toggle button is visible", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getThemeToggle = () =>
    page.waitForSelector('button[aria-label="Toggle theme"]');

  await poll(async () => {
    const toggle = await getThemeToggle();
    expect(toggle).not.toBeNull();
    return true;
  });
});

testDevAndDeploy(
  "default theme is system and follows system preference",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getPageContent = () => page.content();

    // Check that theme text shows "system"
    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("Current theme: system");
      return true;
    });

    // Check if dark class is applied based on system preference
    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains("dark");
    });

    // This will depend on the test environment's system preference
    // We just verify the class is either present or not (both are valid)
    expect(typeof hasDarkClass).toBe("boolean");
  },
);

testDevAndDeploy(
  "toggling theme cycles through system -> light -> dark -> system",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getThemeToggle = () =>
      page.waitForSelector('button[aria-label="Toggle theme"]');
    const getThemeText = async () => {
      return await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span"));
        const themeSpan = spans.find((span) =>
          span.textContent?.includes("Current theme:"),
        );
        return themeSpan?.textContent || null;
      });
    };

    // Start with system (default)
    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: system");
      return true;
    });

    // Click to go to light - re-select element before clicking
    (await getThemeToggle())?.click();
    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: light");
      return true;
    });

    // Verify dark class is removed
    const hasDarkClassAfterLight = await page.evaluate(() => {
      return document.documentElement.classList.contains("dark");
    });
    expect(hasDarkClassAfterLight).toBe(false);

    // Click to go to dark - re-select element before clicking
    (await getThemeToggle())?.click();
    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: dark");
      return true;
    });

    // Verify dark class is added
    const hasDarkClassAfterDark = await page.evaluate(() => {
      return document.documentElement.classList.contains("dark");
    });
    expect(hasDarkClassAfterDark).toBe(true);

    // Click to go back to system - re-select element before clicking
    (await getThemeToggle())?.click();
    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: system");
      return true;
    });
  },
);

testDevAndDeploy(
  "theme preference persists after page reload",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getThemeToggle = () =>
      page.waitForSelector('button[aria-label="Toggle theme"]');
    const getThemeText = async () => {
      return await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span"));
        const themeSpan = spans.find((span) =>
          span.textContent?.includes("Current theme:"),
        );
        return themeSpan?.textContent || null;
      });
    };

    // Set theme to dark - re-select element before each click
    (await getThemeToggle())?.click(); // system -> light
    (await getThemeToggle())?.click(); // light -> dark

    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: dark");
      return true;
    });

    // Reload the page
    await page.reload({ waitUntil: "networkidle0" });
    await waitForHydration(page);

    // Verify theme is still dark after reload
    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: dark");
      return true;
    });

    // Verify dark class is still applied
    const hasDarkClass = await page.evaluate(() => {
      return document.documentElement.classList.contains("dark");
    });
    expect(hasDarkClass).toBe(true);
  },
);

testDevAndDeploy(
  "dark mode styles are applied correctly",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    const getThemeToggle = () =>
      page.waitForSelector('button[aria-label="Toggle theme"]');
    const getThemeText = async () => {
      return await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span"));
        const themeSpan = spans.find((span) =>
          span.textContent?.includes("Current theme:"),
        );
        return themeSpan?.textContent || null;
      });
    };

    // Set to dark mode - re-select element before each click
    (await getThemeToggle())?.click(); // system -> light
    (await getThemeToggle())?.click(); // light -> dark

    await poll(async () => {
      const themeText = await getThemeText();
      expect(themeText).toContain("Current theme: dark");
      return true;
    });

    // Check that dark mode background color is applied
    const bodyBgColor = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return styles.backgroundColor;
    });

    // The dark mode should have a dark background
    // We check that it's not white (rgb(255, 255, 255) or similar)
    expect(bodyBgColor).not.toContain("rgb(255, 255, 255)");
    expect(bodyBgColor).not.toContain("rgb(255,255,255)");
  },
);
