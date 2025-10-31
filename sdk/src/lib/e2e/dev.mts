import debug from "debug";
import { setTimeout as sleep } from "node:timers/promises";
import { $, $sh } from "../../lib/$.mjs";
import { poll } from "./poll.mjs";
import { PackageManager } from "./types.mjs";

const DEV_SERVER_CHECK_TIMEOUT = process.env.RWSDK_DEV_SERVER_CHECK_TIMEOUT
  ? parseInt(process.env.RWSDK_DEV_SERVER_CHECK_TIMEOUT, 10)
  : 5 * 60 * 1000;

const log = debug("rwsdk:e2e:dev");

/**
 * Run the local development server and return the URL
 */
export async function runDevServer(
  packageManager: PackageManager = "pnpm",
  cwd?: string,
): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  console.log("🚀 Starting development server...");

  // Function to stop the dev server - defined early so we can use it in error handling
  let devProcess: any = null;
  let isErrorExpected = false;

  const stopDev = async () => {
    isErrorExpected = true;

    if (!devProcess || !devProcess.pid) {
      log("No dev process to stop or PID is missing");
      return;
    }

    console.log("Stopping development server...");

    if (process.platform === "win32") {
      try {
        await $sh(`taskkill /pid ${devProcess.pid} /f /t`);
      } catch (err) {
        log("Failed to kill process tree with taskkill:", err);
      }
    } else {
      // On Unix-like systems, we kill the entire process group by sending a signal
      // to the negative PID. This is the equivalent of the `/t` flag for `taskkill` on Windows.
      // This relies on `detached: true` being set in the execa options, which makes
      // the child process the leader of a new process group.
      try {
        process.kill(-devProcess.pid, "SIGKILL");
      } catch (e) {
        log(
          "Failed to kill process group. This may happen if the process already exited. %O",
          e,
        );
      }
    }

    await devProcess.catch(() => {
      // We expect this promise to reject when the process is killed,
      // so we catch and ignore the error.
    });

    console.log("Development server stopped");
  };

  try {
    // Check if we're in CI mode
    const inCIMode = process.env.CI === "true" || process.env.CI === "1";

    // Start dev server with stdout pipe to capture URL
    // Create environment variables object
    const env: Record<string, string> = {
      ...process.env,
      NODE_ENV: "development",
    };

    // Disable colors when running in CI mode to make URL parsing more reliable
    if (inCIMode) {
      log("Running in CI mode, disabling colors for dev server output");
      env.NO_COLOR = "1";
      env.FORCE_COLOR = "0";
    }

    // Map package manager names to actual commands
    const getPackageManagerCommand = (pm: string) => {
      switch (pm) {
        case "yarn-classic":
          return "yarn";
        default:
          return pm;
      }
    };

    const pm = getPackageManagerCommand(packageManager);

    // Use the provided cwd if available
    devProcess = $({
      all: true,
      detached: true, // Re-enable for reliable process cleanup
      cleanup: true, // Let execa handle cleanup
      forceKillAfterTimeout: 2000, // Force kill if graceful shutdown fails
      cwd: cwd || process.cwd(), // Use provided directory or current directory
      env, // Pass the updated environment variables
      stdio: "pipe", // Ensure streams are piped
    })`${pm} run dev`;

    devProcess.catch((error: any) => {
      if (!isErrorExpected) {
        // Don't re-throw. The error will be handled gracefully by the polling
        // logic in `waitForUrl`, which will detect that the process has exited.
        // Re-throwing here would cause an unhandled promise rejection.
        log("Dev server process exited unexpectedly:", error.shortMessage);
      }
    });

    log(
      "Development server process spawned in directory: %s",
      cwd || process.cwd(),
    );

    // Store chunks to parse the URL
    let url = "";
    let allOutput = "";

    // Listen for all output to get the URL
    const handleOutput = (data: Buffer, source: string) => {
      const output = data.toString();
      // Raw output for debugging
      process.stdout.write(`[dev:${source}] ` + output);
      allOutput += output; // Accumulate all output
      log("Received output from %s: %s", source, output.replace(/\n/g, "\\n"));

      if (!url) {
        // Multiple patterns to catch different package manager outputs
        const patterns = [
          // Standard Vite output: "Local:   http://localhost:5173/"
          /Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          // Alternative Vite output: "➜  Local:   http://localhost:5173/"
          /[➜→]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          // Unicode-safe arrow pattern
          /[\u27A1\u2192\u279C]\s*Local:\s*(?:\u001b\[\d+m)?(https?:\/\/localhost:\d+)/i,
          // Direct URL pattern: "http://localhost:5173"
          /(https?:\/\/localhost:\d+)/i,
          // Port-only pattern: "localhost:5173"
          /localhost:(\d+)/i,
          // Server ready messages
          /server.*ready.*localhost:(\d+)/i,
          /dev server.*localhost:(\d+)/i,
        ];

        for (const pattern of patterns) {
          const match = output.match(pattern);
          log(
            "Testing pattern %s against output: %s",
            pattern.source,
            output.replace(/\n/g, "\\n"),
          );
          if (match) {
            log("Pattern matched: %s, groups: %o", pattern.source, match);
            if (match[1] && match[1].startsWith("http")) {
              url = match[1];
              log(
                "Found development server URL with pattern %s: %s",
                pattern.source,
                url,
              );
              break;
            } else if (match[1] && /^\d+$/.test(match[1])) {
              url = `http://localhost:${match[1]}`;
              log(
                "Found development server URL with port pattern %s: %s",
                pattern.source,
                url,
              );
              break;
            }
          }
        }

        // Log potential matches for debugging
        if (
          !url &&
          (output.includes("localhost") ||
            output.includes("Local") ||
            output.includes("server"))
        ) {
          log("Potential URL pattern found but not matched: %s", output.trim());
        }
      }
    };

    // Listen to all possible output streams
    log(
      "Setting up stream listeners. Available streams: all=%s, stdout=%s, stderr=%s",
      !!devProcess.all,
      !!devProcess.stdout,
      !!devProcess.stderr,
    );

    devProcess.all?.on("data", (data: Buffer) => handleOutput(data, "all"));
    devProcess.stdout?.on("data", (data: Buffer) =>
      handleOutput(data, "stdout"),
    );
    devProcess.stderr?.on("data", (data: Buffer) =>
      handleOutput(data, "stderr"),
    );

    // Also try listening to the raw process output
    if (devProcess.child) {
      log("Setting up child process stream listeners");
      devProcess.child.stdout?.on("data", (data: Buffer) =>
        handleOutput(data, "child.stdout"),
      );
      devProcess.child.stderr?.on("data", (data: Buffer) =>
        handleOutput(data, "child.stderr"),
      );
    }

    // Wait for URL with timeout
    const waitForUrl = async (): Promise<string> => {
      const start = Date.now();
      const timeout = 60000; // 60 seconds

      while (Date.now() - start < timeout) {
        if (url) {
          return url;
        }

        // Fallback: check accumulated output if stream listeners aren't working
        if (!url && allOutput) {
          log(
            "Checking accumulated output for URL patterns: %s",
            allOutput.replace(/\n/g, "\\n"),
          );
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
                log(
                  "Found URL in accumulated output with pattern %s: %s",
                  pattern.source,
                  url,
                );
                return url;
              } else if (match[1] && /^\d+$/.test(match[1])) {
                url = `http://localhost:${match[1]}`;
                log(
                  "Found URL in accumulated output with port pattern %s: %s",
                  pattern.source,
                  url,
                );
                return url;
              }
            }
          }
        }

        // Check if the process is still running
        if (devProcess.exitCode !== null) {
          log(
            "ERROR: Development server process exited with code %d. Final output: %s",
            devProcess.exitCode,
            allOutput,
          );
          throw new Error(
            `Development server process exited with code ${devProcess.exitCode}`,
          );
        }

        await sleep(500); // Check every 500ms
      }

      log(
        "ERROR: Timed out waiting for dev server URL. Final accumulated output: %s",
        allOutput,
      );
      throw new Error("Timed out waiting for dev server URL");
    };

    // Wait for the URL
    const serverUrl = await waitForUrl();
    console.log(`✅ Development server started at ${serverUrl}`);

    // Poll the URL to ensure it's live before proceeding
    await poll(
      async () => {
        try {
          const response = await fetch(serverUrl, {
            signal: AbortSignal.timeout(1000),
          });
          // We consider any response (even 4xx or 5xx) as success,
          // as it means the worker is routable.
          return response.status > 0;
        } catch (e) {
          return false;
        }
      },
      {
        timeout: DEV_SERVER_CHECK_TIMEOUT,
      },
    );

    return { url: serverUrl, stopDev };
  } catch (error) {
    // Make sure to try to stop the server on error
    log("Error during dev server startup: %O", error);
    await stopDev().catch((e: unknown) => {
      log("Failed to stop dev server during error handling: %O", e);
    });
    throw error;
  }
}
