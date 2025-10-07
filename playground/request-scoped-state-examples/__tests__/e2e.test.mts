import puppeteer from "puppeteer";
import { poll } from "rwsdk/testing";
import { expect, test } from "vitest";

test("request-scoped state isolation", async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("http://localhost:3000");
    await page.waitForFunction('document.readyState === "complete"');

    // Wait for the page to load
    await page.waitForSelector("h2");

    // Check that server-side counter is working
    const serverRequestId = await page.$eval("p", (el) => el.textContent);
    expect(serverRequestId).toContain("Request ID:");

    // Check that server-side counter values are displayed
    const initialValue = await page.$eval(
      "p:nth-of-type(3)",
      (el) => el.textContent,
    );
    expect(initialValue).toContain("Initial Value: 0");

    const afterIncrement = await page.$eval(
      "p:nth-of-type(4)",
      (el) => el.textContent,
    );
    expect(afterIncrement).toContain("After Increment: 1");

    const afterAnotherIncrement = await page.$eval(
      "p:nth-of-type(5)",
      (el) => el.textContent,
    );
    expect(afterAnotherIncrement).toContain("After Another Increment: 2");

    const afterDecrement = await page.$eval(
      "p:nth-of-type(6)",
      (el) => el.textContent,
    );
    expect(afterDecrement).toContain("After Decrement: 1");

    const finalValue = await page.$eval(
      "p:nth-of-type(7)",
      (el) => el.textContent,
    );
    expect(finalValue).toContain("Final Value: 1");

    // Test client-side counter
    const clientRequestId = await page.$eval(
      "p:nth-of-type(9)",
      (el) => el.textContent,
    );
    expect(clientRequestId).toContain("Request ID:");

    // Initialize the client counter
    await page.click('button:contains("Initialize Counter")');

    // Wait for counter to be initialized
    await poll(async () => {
      const counterValue = await page.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 0");
    });

    // Test increment
    await page.click('button:contains("Increment")');
    await poll(async () => {
      const counterValue = await page.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 1");
    });

    // Test decrement
    await page.click('button:contains("Decrement")');
    await poll(async () => {
      const counterValue = await page.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 0");
    });

    // Test reset
    await page.click('button:contains("Reset")');
    await poll(async () => {
      const counterValue = await page.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 0");
    });
  } finally {
    await browser.close();
  }
});

test("multiple tabs maintain separate state", async () => {
  const browser = await puppeteer.launch({ headless: true });

  try {
    // Open two tabs
    const page1 = await browser.newPage();
    const page2 = await browser.newPage();

    // Navigate both tabs to the app
    await Promise.all([
      page1.goto("http://localhost:3000"),
      page2.goto("http://localhost:3000"),
    ]);

    // Wait for both pages to load
    await Promise.all([
      page1.waitForFunction('document.readyState === "complete"'),
      page2.waitForFunction('document.readyState === "complete"'),
    ]);

    // Initialize counters in both tabs
    await Promise.all([
      page1.click('button:contains("Initialize Counter")'),
      page2.click('button:contains("Initialize Counter")'),
    ]);

    // Increment in tab 1
    await page1.click('button:contains("Increment")');
    await page1.click('button:contains("Increment")');

    // Increment in tab 2
    await page2.click('button:contains("Increment")');

    // Check that tab 1 has value 2
    await poll(async () => {
      const counterValue = await page1.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 2");
    });

    // Check that tab 2 has value 1
    await poll(async () => {
      const counterValue = await page2.$eval(
        "p:nth-of-type(10)",
        (el) => el.textContent,
      );
      return counterValue.includes("Counter Value: 1");
    });

    // Verify different request IDs
    const requestId1 = await page1.$eval(
      "p:nth-of-type(9)",
      (el) => el.textContent,
    );
    const requestId2 = await page2.$eval(
      "p:nth-of-type(9)",
      (el) => el.textContent,
    );

    expect(requestId1).not.toEqual(requestId2);
  } finally {
    await browser.close();
  }
});
