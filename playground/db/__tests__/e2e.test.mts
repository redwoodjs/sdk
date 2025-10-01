import { execSync } from "child_process";
import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

const playgroundDir = setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "handles database interactions correctly",
  async ({ page, url }) => {
    // Seed the database before running the test
    execSync("pnpm seed", { cwd: playgroundDir, stdio: "inherit" });

    await page.goto(url);
    await page.waitForFunction('document.readyState === "complete"');

    // Check for seeded data (no testimonials initially)
    await expect(
      page.waitForSelector("text/No testimonials yet", { timeout: 5000 }),
    ).resolves.not.toBeNull();

    // Add a new testimonial
    const testimonialText = "This is a test testimonial!";
    await page.fill('textarea[name="content"]', testimonialText);
    await page.click('button[type="submit"]');

    // Wait for the optimistic update and server response
    await poll(async () => {
      const content = await page.content();
      expect(content).toContain(testimonialText);
      return true;
    });

    // Verify the new testimonial is displayed with author and status
    const cardSelector = ".testimonial-card";
    await page.waitForSelector(cardSelector);
    const cardText = await page.$eval(cardSelector, (el) => el.textContent);
    expect(cardText).toContain(testimonialText);
    expect(cardText).toContain("Test User");
    expect(cardText).toContain("Status: Pending");
  },
);
