import {
  type Browser,
  type Page,
  poll,
  setupPlaygroundEnvironment,
  testDeploy,
  waitForHydration,
} from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment(import.meta.url);

// Repro for: client navigate() payload intermittently never commits under
// main-thread CPU starvation.
//
// Symptom: navigate() updates the URL but the new RSC payload is sometimes
// never committed to the DOM. The page keeps rendering the previous
// navigation's output and does not self-correct within several seconds; only a
// later navigation or a hard reload changes it.
//
// Conditions (both required):
//   1. A production build (NOT vite dev) — hence this is a `testDeploy` test.
//      In PR/CI the e2e harness serves the deploy env from a local
//      `vite preview` of the production build, which is the repro target.
//   2. Main-thread CPU starvation — emulated here via CDP CPU throttling.
//
// Structure: the failure is a per-navigation probability (a navigation whose
// transition commit is dropped under starvation), so reliability is a function
// of throttle * navigation count. We run several trials, each in a fresh
// incognito browser context, and toggle `?v` between "a" and "b" many times
// via a <button> that calls navigate(). After each toggle we wait for the URL
// to update (and poll the committed DOM rather than racing), so there is only
// ever one navigation in flight. A "terminal" failure is a navigation whose
// rendered heading never catches up to the URL within the poll window.
//
// Reproduction rate scales with starvation: on a fast/idle machine it is low
// (~3%/nav at rate 30), but on a busy CI runner it is much higher (the brief
// measured 10-25%/nav at rate 8), because the e2e suite saturates the runner.
// The default config (below) yields multiple failures per run on a fast/idle
// box; raise REPRO_CPU / REPRO_TOGGLES if a faster machine under-reproduces.
//
// Tunables (env):
//   REPRO_CPU=<rate>      CPU throttling factor (default 30)
//   REPRO_SPIN_MS=<ms>    Busy milliseconds per 100ms window injected into the
//                         page's main thread (default 30; set 0 to disable).
//                         Starves the thread React's commit work runs on, so
//                         an abandoned transition shows up within seconds.
//   REPRO_TRIALS=<n>      Fresh-context trials (default 4)
//   REPRO_TOGGLES=<n>     navigate() toggles per trial (default 30)
//   REPRO_COMMIT_MS=<ms>  How long to wait for a commit before calling it
//                         terminal (default 10000)

const CPU_RATE = process.env.REPRO_CPU ? Number(process.env.REPRO_CPU) : 30;
const SPIN_MS = process.env.REPRO_SPIN_MS
  ? Number(process.env.REPRO_SPIN_MS)
  : 30;
const TRIALS = process.env.REPRO_TRIALS ? Number(process.env.REPRO_TRIALS) : 4;
const TOGGLES = process.env.REPRO_TOGGLES
  ? Number(process.env.REPRO_TOGGLES)
  : 30;
const COMMIT_TIMEOUT_MS = process.env.REPRO_COMMIT_MS
  ? Number(process.env.REPRO_COMMIT_MS)
  : 10000;

async function getHeading(page: Page): Promise<string | null> {
  return page.$eval(
    '[data-testid="current-v"]',
    (el) => el.textContent?.trim() ?? null,
  );
}

async function runTrial(
  browser: Browser,
  url: string,
  trial: number,
  failures: string[],
): Promise<number> {
  // Each trial runs in a fresh incognito context (clean navigation Cache API
  // and sessionStorage) so trials are independent samples.
  const context = await browser.createBrowserContext();
  let navigations = 0;
  try {
    const page = await context.newPage();
    const client = await page.createCDPSession();
    await client.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });

    await page.goto(`${url}/list?v=a`);
    await waitForHydration(page);

    if (SPIN_MS > 0) {
      await page.evaluate((spinMs: number) => {
        const cycle = () => {
          const start = performance.now();
          while (performance.now() - start < spinMs) {
            // busy-wait: starve the main thread
          }
          setTimeout(cycle, Math.max(0, 100 - spinMs));
        };
        cycle();
      }, SPIN_MS);
    }

    // Confirm the starting state before toggling.
    await poll(async () => {
      expect(await getHeading(page)).toBe("a");
      return true;
    });

    let current = "a";
    for (let toggle = 0; toggle < TOGGLES; toggle++) {
      const want = current === "a" ? "b" : "a";
      navigations++;

      await page.click('[data-testid="toggle"]');

      // navigate() pushes the new URL before awaiting the RSC fetch, so the
      // URL flips ~immediately; the commit is what we're testing.
      await page.waitForFunction(
        (expected: string) =>
          new URL(location.href).searchParams.get("v") === expected,
        {},
        want,
      );

      // Poll for the committed heading to match the URL.
      let committed = false;
      const deadline = Date.now() + COMMIT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if ((await getHeading(page)) === want) {
          committed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!committed) {
        const heading = await getHeading(page);
        const msg = `trial ${trial} toggle ${toggle}: URL v=${want} but heading="${heading}"`;
        failures.push(msg);
        console.log(`[nav-commit-lag] TERMINAL ${msg}`);
      }

      // Re-sync our notion of the current value to whatever actually
      // committed, so a single stuck navigation doesn't cascade into bogus
      // follow-on failures.
      current = (await getHeading(page)) ?? want;
    }
  } finally {
    await context.close();
  }
  return navigations;
}

testDeploy(
  "navigate() commits the latest payload under CPU throttling",
  async ({ browser, url }) => {
    const failures: string[] = [];
    let navigations = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      navigations += await runTrial(browser, url, trial, failures);
    }

    console.log(
      `[nav-commit-lag] ${failures.length} terminal failure(s) across ${navigations} navigations ` +
        `(CPU rate ${CPU_RATE}, ${TRIALS} trials x ${TOGGLES} toggles)`,
    );

    expect(
      failures,
      `navigate() failed to commit on ${failures.length}/${navigations} navigations:\n${failures.join("\n")}`,
    ).toEqual([]);
  },
);
