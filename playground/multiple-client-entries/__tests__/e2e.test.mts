import { e2e } from "rwsdk/testing";
import { describe, expect, test } from "vitest";

describe("Multiple Client Entries", () => {
  test("The home page should be interactive", async () => {
    await e2e.page.goto(e2e.url);
    await e2e.page.waitForFunction('document.readyState === "complete"');

    const initialCount = await e2e.page.$eval("p", (el) => el.textContent);
    expect(initialCount).toBe("Count: 0");

    await e2e.page.click("button");

    const newCount = await e2e.page.$eval("p", (el) => el.textContent);
    expect(newCount).toBe("Count: 1");
  });

  test("The admin page should be interactive and have its own state", async () => {
    await e2e.page.goto(`${e2e.url}/admin`);
    await e2e.page.waitForFunction('document.readyState === "complete"');

    const initialCount = await e2e.page.$eval("p", (el) => el.textContent);
    expect(initialCount).toBe("Count: 100");

    await e2e.page.click("button");

    const newCount = await e2e.page.$eval("p", (el) => el.textContent);
    expect(newCount).toBe("Count: 101");
  });
});
