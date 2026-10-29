import { setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "runs a server-function form action without browser JavaScript",
  async ({ page, url }) => {
    await page.setJavaScriptEnabled(false);
    await page.goto(url);

    const hiddenFieldNames = await page.$$eval(
      'form input[type="hidden"]',
      (inputs) => inputs.map((input) => input.getAttribute("name")),
    );
    expect(
      hiddenFieldNames.some((name) => name?.startsWith("$ACTION_ID_")),
    ).toBe(true);
    expect(await page.$("#answer-result")).toBeNull();

    let submittedPostData: string | undefined;
    page.on("request", (request) => {
      if (request.method() === "POST") {
        submittedPostData = request.postData();
      }
    });

    await page.type('textarea[name="text"]', "A form answer");
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    expect(response?.status()).toBe(200);
    expect(submittedPostData).toContain("$ACTION_ID_");
    expect(submittedPostData).toContain("A form answer");
    expect(
      await page.$eval("#answer-result", (element) => element.textContent),
    ).toBe("The server function ran with: A form answer");
  },
);
