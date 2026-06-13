import { poll, setupPlaygroundEnvironment, testDevAndDeploy } from "rwsdk/e2e";
import { expect, vi } from "vitest";

vi.setConfig({ testTimeout: 300000 });

setupPlaygroundEnvironment(import.meta.url);

const textContent = async (page: any, selector: string) =>
  page.$eval(selector, (element: Element) => element.textContent ?? "");

const expectText = async (page: any, selector: string, expected: string) => {
  await poll(async () => {
    expect(await textContent(page, selector)).toContain(expected);
    return true;
  });
};

const expectProofs = async (page: any, proofs: string[]) => {
  await poll(async () => {
    const missing = await page.evaluate((proofs: string[]) => {
      return proofs.filter(
        (proof) => !document.querySelector(`[data-proof="${proof}"]`),
      );
    }, proofs);

    expect(missing).toEqual([]);
    return true;
  });
};

const clickUntilText = async (
  page: any,
  clickSelector: string,
  textSelector: string,
  expected: string,
) => {
  await poll(async () => {
    await page.click(clickSelector);
    expect(await textContent(page, textSelector)).toContain(expected);
    return true;
  });
};

testDevAndDeploy("renders plugin-rsc client-reference fixture in the browser", async ({ page, url }) => {
  await page.goto(url);

  await expectText(page, "h1", "Hello World");
  await expectProofs(page, [
    "vite-rsc-client-adapter-fixture",
    "named-button",
    "named-label",
    "default-only",
    "mixed-default",
    "mixed-named",
    "re-exported-button",
    "duplicate-a",
    "duplicate-b",
    "dynamic-target",
    "server-proof-client",
  ]);

  await expectText(page, "#named-count", "Named count: 0");
  await clickUntilText(page, "#named-count", "#named-count", "Named count: 1");

  await clickUntilText(
    page,
    "#server-query-proof",
    "#server-proof-result",
    "Hello, Adapter! (serverQuery preserved)",
  );

  await clickUntilText(
    page,
    "#server-action-proof",
    "#server-proof-result",
    "Updated Adapter (serverAction preserved)",
  );
});

testDevAndDeploy("renders and hydrates an ssr:false client reference route", async ({ page, url }) => {
  await page.goto(new URL("/ssr-off/", url).toString());

  await expectText(page, "h1", "SSR false proof");
  await expectProofs(page, ["ssr-false-client"]);
  await expectProofs(page, ["server-proof-client"]);
  await expectText(page, "#server-proof-result", "idle");

  await clickUntilText(
    page,
    "#server-query-proof",
    "#server-proof-result",
    "Hello, Adapter! (serverQuery preserved)",
  );
});

// Rollback-mode coverage for this work lives in redwoodPlugin.test.mts because
// those env flags change Vite plugin setup before the shared e2e harness starts
// the dev/deploy app. HMR rsc:update vs full-reload coverage lives in
// miniflareHMRPlugin.test.mts; browser-level state-preserving HMR remains a
// larger fixture/harness project beyond this focused hello-world assertion pass.
