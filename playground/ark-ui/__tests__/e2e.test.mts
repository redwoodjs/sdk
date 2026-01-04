import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll, waitForHydration } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy("Ark UI comprehensive playground", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getElementText = (selector: string) =>
    page.$eval(selector, (el) => el.textContent);

  await poll(async () => {
    const mainTitle = await getElementText('h1');
    expect(mainTitle).toContain("Ark UI Playground");

    const subtitle = await getElementText('p');
    expect(subtitle).toContain("Component showcase for RedwoodSDK with Ark UI");

    const headings = await page.$$eval("h3", (nodes) =>
      nodes.map((n) => n.textContent),
    );
    expect(headings).toContain("Accordion");
    expect(headings).toContain("Checkbox");
    expect(headings).toContain("Switch");
    expect(headings).toContain("Slider");
    expect(headings).toContain("Radio Group");

    const content = await page.content();
    expect(content).toContain("What is React?");
    expect(content).toContain("Features");
    expect(content).toContain("Styling");

    const checkboxStatuses = await page.$$eval('#checkbox + .section-content input[type="checkbox"]', (nodes) =>
      nodes.map((n) => (n as HTMLInputElement).checked),
    );
    expect(checkboxStatuses).toEqual([false, true, false]);

    const switchStatuses = await page.$$eval('#switch + .section-content input[type="checkbox"]', (nodes) =>
      nodes.map((n) => (n as HTMLInputElement).checked),
    );
    expect(switchStatuses).toEqual([false, true, false]);

    const radioStatuses = await page.$$eval('#radio + .section-content input[type="radio"]', (nodes) =>
      nodes.map((n) => (n as HTMLInputElement).checked),
    );
    expect(radioStatuses).toEqual([true, false, false]);
    return true;
  });

  await page.click('text=What is Vue?');
  const vueContentPresent = await poll(async () => {
    const c = await page.content();
    return c.includes("Vue is a powerful JavaScript");
  });
  expect(vueContentPresent).toBe(true);

  await page.click('text=Accessibility');
  const accContentPresent = await poll(async () => {
    const c = await page.content();
    return c.includes("Built with accessibility in mind");
  });
  expect(accContentPresent).toBe(true);

  await page.click('text=Accept terms');
  const checkboxStatusesAfter = await page.$$eval('#checkbox + .section-content input[type="checkbox"]', (nodes) =>
    nodes.map((n) => (n as HTMLInputElement).checked),
  );
  expect(checkboxStatusesAfter[0]).toBe(true);

  const firstSwitch = await page.$('#switch + .section-content input[type="checkbox"]');
  await firstSwitch?.click();
  const switchStatusesAfter = await page.$$eval('#switch + .section-content input[type="checkbox"]', (nodes) =>
    nodes.map((n) => (n as HTMLInputElement).checked),
  );
  expect(switchStatusesAfter[0]).toBe(true);

  const firstThumb = await page.waitForSelector('#slider + .section-content [role="slider"]');
  const initialValue = await firstThumb?.evaluate((el) => el.getAttribute('aria-valuenow'));
  await firstThumb?.press('ArrowRight');
  const afterValue = await firstThumb?.evaluate((el) => el.getAttribute('aria-valuenow'));
  if (initialValue && afterValue) {
    expect(Number(afterValue)).toBeGreaterThanOrEqual(Number(initialValue));
  }

  await page.click('text=Vue');
  const radioStatusesAfter = await page.$$eval('#radio + .section-content input[type="radio"]', (nodes) =>
    nodes.map((n) => (n as HTMLInputElement).checked),
  );
  expect(radioStatusesAfter).toEqual([false, true, false]);
});
