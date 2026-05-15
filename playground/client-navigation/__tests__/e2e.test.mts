import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello World");
    return true;
  });
});

testDevAndDeploy(
  "programmatically navigates on button click",
  async ({ page, url }) => {
    await page.goto(url);

    await waitForHydration(page);

    await page.click("#navigate-to-about");

    const getPageContent = () => page.content();

    await poll(async () => {
      const content = await getPageContent();
      expect(content).toContain("About Page");
      expect(content).not.toContain("Hello World");
      return true;
    });

    expect(page.url()).toContain("/about");
  },
);

testDevAndDeploy(
  "renders a navigation preload link for /about in the head",
  async ({ page, url }) => {
    await page.goto(url);

    await waitForHydration(page);

    // React will hoist this <link> into <head>, and the client navigation
    // runtime will use it to warm the navigation cache for /about.
    await page.waitForSelector('link[rel="x-prefetch"][href="/about"]');
  },
);

testDevAndDeploy("navigates on link click", async ({ page, url }) => {
  await page.goto(url);

  await waitForHydration(page);

  await page.click("#about-link");

  const getPageContent = () => page.content();

  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("About Page");
    expect(content).not.toContain("Hello World");
    return true;
  });

  expect(page.url()).toContain("/about");
});

// Regression test for https://github.com/redwoodjs/sdk/issues/1104.
// The browser's default scroll restoration runs before the RSC payload
// commits, causing the old DOM to flash at the new scroll offset. We take
// manual control so scroll adjustments happen post-commit.
testDevAndDeploy(
  "takes manual control of scroll restoration",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);
    const mode = await page.evaluate(() => history.scrollRestoration);
    expect(mode).toBe("manual");
  },
);

testDevAndDeploy(
  "scrolls to top after client-side link navigation",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    await page.evaluate(() => window.scrollTo(0, 500));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // Use element.click() rather than page.click() so Puppeteer does not
    // auto-scroll the link into view and clobber our scroll position.
    await page.evaluate(() =>
      (document.getElementById("about-link") as HTMLElement).click(),
    );

    await poll(async () => {
      const content = await page.content();
      expect(content).toContain("About Page");
      expect(content).not.toContain("Hello World");
      return true;
    });

    await poll(async () => {
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      return true;
    });
  },
);

testDevAndDeploy(
  "restores scroll position when navigating back",
  async ({ page, url }) => {
    await page.goto(url);
    await waitForHydration(page);

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.evaluate(() =>
      (document.getElementById("about-link") as HTMLElement).click(),
    );

    await poll(async () => {
      expect(await page.content()).toContain("About Page");
      return true;
    });

    await page.goBack();

    await poll(async () => {
      expect(await page.content()).toContain("Hello World");
      return true;
    });

    await poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      // Exact restore would be 500; allow a small tolerance for subpixel
      // rendering differences across browsers.
      expect(Math.abs(y - 500)).toBeLessThan(50);
      return true;
    });
  },
);
