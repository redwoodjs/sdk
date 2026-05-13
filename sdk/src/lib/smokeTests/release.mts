import { setTimeout } from "node:timers/promises";
import { $ } from "../$.mjs";
import {
  $expect,
  deleteD1Database,
  deleteWorker,
  isRelatedToTest,
  listD1Databases,
  runRelease as runE2ERelease,
} from "../../lib/e2e/release.mjs";
import { checkServerUp, checkUrl } from "./browser.mjs";
import { log } from "./constants.mjs";
import { state } from "./state.mjs";
import { TestResources } from "./types.mjs";

export {
  $expect,
  deleteD1Database,
  deleteWorker,
  isRelatedToTest,
  listD1Databases,
};

/**
 * Run the release command to deploy to Cloudflare
 */
export async function runRelease(
  cwd: string,
  projectDir: string,
  resourceUniqueKey: string,
): Promise<{ url: string; workerName: string }> {
  return runE2ERelease(cwd, projectDir, resourceUniqueKey);
}

/**
 * Run the local preview server (build + preview) and return the URL
 */
export async function runPreviewServer(
  packageManager: string = "pnpm",
  cwd?: string,
): Promise<{ url: string; stopPreview: () => Promise<void> }> {
  console.log("🚀 Building for production preview...");

  const pm = packageManager === "yarn-classic" ? "yarn" : packageManager;

  await $(pm, ["run", "build"], {
    cwd: cwd || process.cwd(),
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production" },
  });

  console.log("✅ Build complete. Starting preview server...");

  let previewProcess: any = null;
  let isErrorExpected = false;

  const stopPreview = async () => {
    isErrorExpected = true;
    if (!previewProcess || !previewProcess.pid) {
      return;
    }
    console.log("Stopping preview server...");
    if (process.platform !== "win32") {
      try {
        process.kill(-previewProcess.pid, "SIGKILL");
      } catch {}
    }
    await previewProcess.catch(() => {});
    console.log("Preview server stopped");
  };

  previewProcess = $(pm, ["run", "preview"], {
    all: true,
    detached: process.platform !== "win32",
    cleanup: true,
    forceKillAfterTimeout: 2000,
    cwd: cwd || process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
  });

  previewProcess.catch((error: any) => {
    if (!isErrorExpected) {
      log("Preview server process exited unexpectedly: %O", error);
    }
  });

  let url = "";
  let allOutput = "";

  const handleOutput = (data: Buffer) => {
    const output = data.toString();
    allOutput += output;
    if (!url) {
      const patterns = [
        /Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
        /[➜→]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
        /[\u27A1\u2192\u279C]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
        /(https?:\/\/localhost:\d+)/i,
        /localhost:(\d+)/i,
        /server.*ready.*localhost:(\d+)/i,
        /dev server.*localhost:(\d+)/i,
      ];
      for (const pattern of patterns) {
        const match = output.match(pattern);
        if (match) {
          if (match[1] && match[1].startsWith("http")) {
            url = match[1];
            break;
          } else if (match[1] && /^\d+$/.test(match[1])) {
            url = `http://localhost:${match[1]}`;
            break;
          }
        }
      }
    }
  };

  if (previewProcess.all) {
    previewProcess.all.on("data", (data: Buffer) => handleOutput(data));
  } else {
    previewProcess.stdout?.on("data", (data: Buffer) => handleOutput(data));
    previewProcess.stderr?.on("data", (data: Buffer) => handleOutput(data));
  }

  const waitForUrl = async (): Promise<string> => {
    const start = Date.now();
    const timeout = 60000;
    while (Date.now() - start < timeout) {
      if (url) return url;
      if (!url && allOutput) {
        const patterns = [
          /Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          /[➜→]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          /[\u27A1\u2192\u279C]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          /(https?:\/\/localhost:\d+)/i,
          /localhost:(\d+)/i,
        ];
        for (const pattern of patterns) {
          const match = allOutput.match(pattern);
          if (match) {
            if (match[1] && match[1].startsWith("http")) {
              url = match[1];
              return url;
            } else if (match[1] && /^\d+$/.test(match[1])) {
              url = `http://localhost:${match[1]}`;
              return url;
            }
          }
        }
      }
      if (previewProcess.exitCode !== null) {
        throw new Error(
          `Preview server process exited with code ${previewProcess.exitCode}`,
        );
      }
      await setTimeout(500);
    }
    throw new Error("Timed out waiting for preview server URL");
  };

  const serverUrl = await waitForUrl();
  console.log(`✅ Preview server started at ${serverUrl}`);

  await checkServerUp(serverUrl, "/", 30);

  return { url: serverUrl, stopPreview };
}

async function waitForDeploymentContent(
  baseUrl: string,
  {
    timeoutMs = 60_000,
    intervalMs = 2_000,
  }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const marker = "__RWSDK_CONTEXT";
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastStatus: number | undefined;
  let lastBytes = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(baseUrl);
      const body = await res.text();
      lastStatus = res.status;
      lastBytes = body.length;
      if (body.includes(marker)) {
        log(
          "Deployment content verified at %s after %d attempt(s)",
          baseUrl,
          attempt,
        );
        console.log(
          `✅ Deployment content ready at ${baseUrl} (attempt ${attempt})`,
        );
        return;
      }
      log(
        "Attempt %d: %s returned %d (%d bytes), no app marker yet",
        attempt,
        baseUrl,
        res.status,
        body.length,
      );
    } catch (err) {
      log("Attempt %d: fetch failed for %s: %O", attempt, baseUrl, err);
    }
    await setTimeout(intervalMs);
  }
  throw new Error(
    `Deployment at ${baseUrl} did not serve app content within ${timeoutMs}ms ` +
      `(last status ${lastStatus ?? "n/a"}, ${lastBytes} bytes). ` +
      `Likely Cloudflare *.workers.dev propagation still in progress.`,
  );
}

/**
 * Runs tests against the production deployment
 */
export async function runReleaseTest(
  artifactDir: string,
  resources: TestResources,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  projectDir?: string,
  realtime: boolean = false,
  skipHmr: boolean = false,
  skipStyleTests: boolean = false,
  ci: boolean = false,
): Promise<void> {
  log("Starting release test");
  console.log("\n🚀 Testing production deployment");

  let url: string;
  let stopPreview: (() => Promise<void>) | undefined;

  try {
    if (ci) {
      log("CI mode detected — using local preview instead of deploy");
      const previewResult = await runPreviewServer(
        state.options.packageManager,
        resources.targetDir || "",
      );
      url = previewResult.url;
      stopPreview = previewResult.stopPreview;
    } else {
      log("Running release process");
      const { url: deployUrl, workerName } = await runRelease(
        resources.targetDir || "",
        projectDir || "",
        resources.resourceUniqueKey,
      );
      url = deployUrl;

      // Wait a moment before checking server availability
      log("Waiting 1s before checking server...");
      await setTimeout(1000);

      // DRY: check both root and custom path
      await checkServerUp(url, "/");

      // A fresh *.workers.dev subdomain can return 200 with Cloudflare's
      // "There is nothing here yet" placeholder before the worker code is
      // globally propagated. Poll the URL until the response body contains
      // an rwsdk-rendered marker so we don't run the browser tests against
      // the placeholder.
      await waitForDeploymentContent(url);

      // Store the worker name if we didn't set it earlier
      if (resources && !resources.workerName) {
        log("Storing worker name: %s", workerName);
        resources.workerName = workerName;
      }

      // Mark that we created this worker during the test
      if (resources) {
        log("Marking worker %s as created during this test", workerName);
        resources.workerCreatedDuringTest = true;

        // Update the global state
        if (resources.workerCreatedDuringTest !== undefined) {
          resources.workerCreatedDuringTest = true;
        }
      }
    }

    // Now run the tests with the custom path
    const testUrl = new URL("/__smoke_test", url).toString();
    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
      "Production",
      realtime,
      resources.targetDir, // Add target directory parameter
      true, // Always skip HMR in production
      skipStyleTests, // Add skip style tests option
    );
    log("Release test completed successfully");
  } catch (error) {
    log("Error during release testing: %O", error);
    throw error;
  } finally {
    if (stopPreview) {
      await stopPreview().catch((e) => {
        log("Error stopping preview server: %O", e);
      });
    }
  }
}
