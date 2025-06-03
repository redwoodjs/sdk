import { setTimeout } from "node:timers/promises";
import { log, RETRIES } from "./constants.mjs";
import { $ } from "../$.mjs";
import { checkUrl, checkServerUp } from "./browser.mjs";
import { fail } from "./utils.mjs";
import { state } from "./state.mjs";

/**
 * Run the local development server and return the URL
 */
export async function runDevServer(cwd?: string): Promise<{
  url: string;
  stopDev: () => Promise<void>;
}> {
  console.log("🚀 Starting development server...");

  // Function to stop the dev server - defined early so we can use it in error handling
  let devProcess: any = null;
  let isErrorExpected = false;

  const stopDev = async () => {
    isErrorExpected = true;

    if (!devProcess) {
      log("No dev process to stop");
      return;
    }

    console.log("Stopping development server...");

    try {
      // Send a regular termination signal first
      devProcess.kill();

      // Wait for the process to terminate with a timeout
      const terminationTimeout = 5000; // 5 seconds timeout
      const terminationPromise = Promise.race([
        // Wait for natural process termination
        (async () => {
          try {
            await devProcess;
            log("Dev server process was terminated normally");
            return true;
          } catch (e) {
            // Expected error when the process is killed
            log("Dev server process was terminated");
            return true;
          }
        })(),
        // Or timeout
        (async () => {
          await setTimeout(terminationTimeout);
          return false;
        })(),
      ]);

      // Check if process terminated within timeout
      const terminated = await terminationPromise;

      // If not terminated within timeout, force kill
      if (!terminated) {
        log(
          "Dev server process did not terminate within timeout, force killing with SIGKILL",
        );
        console.log(
          "⚠️ Development server not responding after 5 seconds timeout, force killing...",
        );

        // Try to kill with SIGKILL if the process still has a pid
        if (devProcess.pid) {
          try {
            // Use process.kill with SIGKILL for a stronger termination
            process.kill(devProcess.pid, "SIGKILL");
            log("Sent SIGKILL to process %d", devProcess.pid);
          } catch (killError) {
            log("Error sending SIGKILL to process: %O", killError);
            // Non-fatal, as the process might already be gone
          }
        }
      }
    } catch (e) {
      // Process might already have exited
      log("Could not kill dev server process: %O", e);
    }

    console.log("Development server stopped");
  };

  try {
    // Check if we're in CI mode
    const inCIMode = process.env.CI === "true" || process.env.CI === "1";

    // Start dev server with stdout pipe to capture URL
    // Create environment variables object
    const env = { ...process.env };

    // Disable colors when running in CI mode to make URL parsing more reliable
    if (inCIMode) {
      log("Running in CI mode, disabling colors for dev server output");
      env.NO_COLOR = "1";
      env.FORCE_COLOR = "0";
    }

    // Use the provided cwd if available
    devProcess = $({
      stdio: ["inherit", "pipe", "pipe"], // Pipe stderr again to check both streams
      detached: true,
      cleanup: false, // Don't auto-kill on exit
      cwd: cwd || process.cwd(), // Use provided directory or current directory
      env, // Pass the updated environment variables
    })`npm run dev`;

    devProcess.catch((error: any) => {
      if (!isErrorExpected) {
        // Use fail() directly here to properly handle errors from the dev process
        fail(error, 1, "Development Server Process");
      }
    });

    log(
      "Development server process spawned in directory: %s",
      cwd || process.cwd(),
    );

    // Store chunks to parse the URL
    let url = "";

    // Listen for stdout to get the URL
    devProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(output);

      // Try to extract the URL from the server output with a more flexible regex
      // Allow for variable amounts of whitespace between "Local:" and the URL
      // And handle ANSI color codes by using a more robust pattern
      const localMatch = output.match(/Local:.*?(http:\/\/localhost:\d+)/);
      if (localMatch && localMatch[1] && !url) {
        url = localMatch[1];
        log("Found development server URL: %s", url);
      } else if (
        output.includes("Local:") &&
        output.includes("http://localhost:")
      ) {
        // Log near-match for debugging
        log(
          "Found potential URL pattern but regex didn't match. Content: %s",
          output,
        );

        // Try an alternative, more general pattern that's more resilient to ANSI codes
        const altMatch = output.match(/localhost:(\d+)/i);
        if (altMatch && altMatch[1] && !url) {
          url = `http://localhost:${altMatch[1]}`;
          log("Found development server URL with alternative pattern: %s", url);
        }
      }
    });

    // Also listen for stderr to check for URL patterns there as well
    devProcess.stderr?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.error(output); // Output error messages to console

      // Check if we already found a URL
      if (url) return;

      // Check for localhost URLs in stderr using the same resilient patterns as stdout
      const urlMatch = output.match(/localhost:(\d+)/i);
      if (urlMatch && urlMatch[1]) {
        url = `http://localhost:${urlMatch[1]}`;
        log("Found development server URL in stderr: %s", url);
      }
    });

    // Wait for URL with timeout
    const waitForUrl = async (): Promise<string> => {
      const start = Date.now();
      const timeout = 60000; // 60 seconds

      while (Date.now() - start < timeout) {
        if (url) {
          return url;
        }

        // Check if the process is still running
        if (devProcess.exitCode !== null) {
          log(
            "ERROR: Development server process exited with code %d",
            devProcess.exitCode,
          );
          throw new Error(
            `Development server process exited with code ${devProcess.exitCode}`,
          );
        }

        await setTimeout(500); // Check every 500ms
      }

      log("ERROR: Timed out waiting for dev server URL");
      throw new Error("Timed out waiting for dev server URL");
    };

    // Wait for the URL
    const serverUrl = await waitForUrl();
    console.log(`✅ Development server started at ${serverUrl}`);
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

/**
 * Runs tests against the development server
 */
export async function runDevTest(
  url: string,
  artifactDir: string,
  customPath: string = "/",
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  realtime: boolean = false,
  skipHmr: boolean = false,
): Promise<void> {
  log("Starting dev server test with path: %s", customPath || "/");
  console.log("🚀 Testing local development server");

  try {
    // DRY: check both root and custom path
    await checkServerUp(url, customPath, RETRIES, bail);

    // Now run the tests with the custom path
    const testUrl =
      url +
      (customPath === "/"
        ? ""
        : customPath.startsWith("/")
          ? customPath
          : "/" + customPath);

    // Pass the target directory to checkUrl for HMR testing
    const targetDir = state.resources.targetDir;

    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
      "Development", // Add environment context parameter
      realtime, // Add realtime parameter
      targetDir, // Add target directory for HMR testing
      skipHmr, // Add skip HMR option
    );
    log("Development server test completed successfully");
  } catch (error) {
    // Add more context about the specific part that failed
    if (error instanceof Error && error.message.includes("Server at")) {
      state.failures.push({
        step: "Development - Server Availability",
        error: error.message,
        details: error.stack,
      });
    }
    log("Error during development server testing: %O", error);
    // Make sure we throw the error so it's properly handled upstream
    throw error;
  }
}
