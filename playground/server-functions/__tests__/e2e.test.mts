import {
  poll,
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  waitForHydration,
  type Page,
  type HTTPResponse,
} from "rwsdk/e2e";
import { expect, vi, type Assertion } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

vi.setConfig({ testTimeout: 300000 });

async function getServerFunctionResult(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      const win = window as any;
      const storedResult = win.__serverFunctionsLastResult ?? "";
      const domResult =
        document.getElementById("server-function-result")?.textContent ?? "";
      const actionMarker = win.__lastActionResponseMarker ?? "";
      return [storedResult, domResult, actionMarker]
        .filter((value) => typeof value === "string" && value.length > 0)
        .join(" | ");
    });
  } catch {
    return "";
  }
}

async function waitForRedirectUrl(
  page: Page,
  fragment: string,
  timeout = 5000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (page.url().includes(fragment)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function captureServerFunctionResponse(page: Page, actionId: string) {
  const encodedActionId = encodeURIComponent(actionId);
  let status: null | number = null;
  let location: null | string = null;

  const onResponse = (response: HTTPResponse) => {
    const url = response.url();
    if (!url.includes("__rsc_action_id=") || !url.includes(encodedActionId)) {
      return;
    }

    status = response.status();
    location = response.headers().location ?? null;
  };

  page.on("response", onResponse);

  return {
    get() {
      return { status, location };
    },
    dispose() {
      page.off("response", onResponse);
    },
  };
}

testDevAndDeploy("server functions demo is visible", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const getDemoTitle = () => page.$("text=Server Functions Demo");

  await poll(async () => {
    const demoTitle = await getDemoTitle();
    expect(demoTitle).not.toBeNull();
    return true;
  });
});

testDevAndDeploy("serverQuery (GET) works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-get-greeting");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe("Hello, World! (from serverQuery GET)");
    return true;
  });
});

testDevAndDeploy("serverQuery (POST) works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-get-greeting-post");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe("Hello, World! (from serverQuery POST)");
    return true;
  });
});

testDevAndDeploy("serverAction works", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  await page.click("#run-update-name");

  await poll(async () => {
    const result = await page.$eval(
      "#server-function-result",
      (el) => el.textContent,
    );
    expect(result).toBe(
      '"Greeting updated to: Hello, New Name! (from serverAction POST)"',
    );
    return true;
  });
});

testDevAndDeploy("serverQuery redirect middleware returns redirect metadata", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const responseCapture = captureServerFunctionResponse(
    page,
    "/src/app/actions.ts#getRedirectQuery",
  );

  await page.click("#run-get-redirect-query");

  const redirected = await waitForRedirectUrl(
    page,
    "/redirect?source=redirect-middleware",
  );

  if (redirected) {
    await poll(async () => {
      const heading = await page.$eval("h1", (el) => el.textContent);
      expect(heading).toBe("Redirected!");
      return true;
    });
    return;
  }

  try {
    await poll(async () => {
      const { status, location } = responseCapture.get();
      const networkRedirect =
        status === 303 &&
        (location ?? "").includes("/redirect?source=redirect-middleware");

      const result = await getServerFunctionResult(page);
      const handledWithoutNavigation = result.includes("redirect-handled");
      const metadataReturned =
        result.includes("status=303") &&
        result.includes("/redirect?source=redirect-middleware");
      return networkRedirect || handledWithoutNavigation || metadataReturned;
    });
  } finally {
    responseCapture.dispose();
  }
});

testDevAndDeploy("serverAction redirect middleware navigates to error page", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const responseCapture = captureServerFunctionResponse(
    page,
    "/src/app/actions.ts#getRedirectAction",
  );

  await page.click("#run-get-redirect-action");

  const redirected = await waitForRedirectUrl(
    page,
    "/redirect?source=redirect-action",
  );

  if (redirected) {
    await poll(async () => {
      const heading = await page.$eval("h1", (el) => el.textContent);
      expect(heading).toBe("Redirected!");
      return true;
    });
    return;
  }

  try {
    await poll(async () => {
      const { status, location } = responseCapture.get();
      const networkRedirect =
        status === 303 &&
        (location ?? "").includes("/redirect?source=redirect-action");

      const result = await getServerFunctionResult(page);
      const hasRedirectResponseMarker =
        result.includes("action-response-status=303") &&
        result.includes("/redirect?source=redirect-action");
      const handledWithoutNavigation = result.includes("redirect-handled");
      return networkRedirect || hasRedirectResponseMarker || handledWithoutNavigation;
    });
  } finally {
    responseCapture.dispose();
  }
});

testDevAndDeploy("serverQuery error middleware returns response metadata without redirect", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const responseCapture = captureServerFunctionResponse(
    page,
    "/src/app/actions.ts#getErrorQuery",
  );

  await page.click("#run-get-error-query");

  try {
    await poll(async () => {
      if (page.url().includes("/error")) {
        return false;
      }

      const { status, location } = responseCapture.get();
      const networkError = status === 400 && !location;

      const result = await getServerFunctionResult(page);
      const metadataError =
        result.includes("status=400") && result.includes("location=null");

      return networkError || metadataError;
    });
  } catch (error) {
    const { status, location } = responseCapture.get();
    const result = await getServerFunctionResult(page).catch(() => "<error>");
    throw new Error(
      `${(error as Error).message}; status=${status}; location=${location}; result=${result}`,
    );
  } finally {
    responseCapture.dispose();
  }
});

testDevAndDeploy("serverAction error middleware returns response metadata without redirect", async ({ page, url }) => {
  await page.goto(url);
  await waitForHydration(page);

  const responseCapture = captureServerFunctionResponse(
    page,
    "/src/app/actions.ts#getErrorAction",
  );

  await page.click("#run-get-error-action");

  try {
    await poll(async () => {
      if (page.url().includes("/error")) {
        return false;
      }

      const { status, location } = responseCapture.get();
      const networkError = status === 400 && !location;

      const result = await getServerFunctionResult(page);
      const metadataError =
        result.includes("status=400") && result.includes("location=null");

      return networkError || metadataError;
    });
  } catch (error) {
    const { status, location } = responseCapture.get();
    const result = await getServerFunctionResult(page).catch(() => "<error>");
    throw new Error(
      `${(error as Error).message}; status=${status}; location=${location}; result=${result}`,
    );
  } finally {
    responseCapture.dispose();
  }
});
