import { join } from "path";
import { setupArtifactsDirectory } from "./artifacts.mjs";
import { getBrowserPath } from "./browser.mjs";
import { runDevServer, runDevTest } from "./development.mjs";
import { setupTestEnvironment } from "./environment.mjs";
import { runReleaseTest } from "./release.mjs";
import { initializeTestStatus } from "./reporting.mjs";
import { state, updateTestStatus } from "./state.mjs";
import { SmokeTestOptions } from "./types.mjs";
import { fail, log, teardown } from "./utils.mjs";

/**
 * Main function that orchestrates the smoke test flow
 */
export async function runSmokeTests(
  options: SmokeTestOptions = {},
): Promise<void> {
  log("Starting smoke test with options: %O", options);

  // Store options in state immediately for force report generation if needed
  state.options = options;

  // Initialize test status based on options
  initializeTestStatus();

  // Set default artifacts directory if not specified
  if (!options.artifactDir) {
    options.artifactDir = join(process.cwd(), ".artifacts");
    log("Using default artifacts directory: %s", options.artifactDir);

    // Update state.options with the default value
    state.options.artifactDir = options.artifactDir;
  }

  // Clean and recreate artifacts directory
  await setupArtifactsDirectory(options.artifactDir, options);
  log("Initialized log capturing to artifact files");

  // Throw immediately if both tests would be skipped
  if (options.skipDev && options.skipRelease) {
    log("Error: Both dev and release tests are skipped");
    await fail(
      new Error(
        "Cannot skip both dev and release tests. At least one must run.",
      ),
      1,
      "Configuration",
    );
  }

  // Prepare browser early to avoid waiting later
  console.log("🔍 Preparing browser for testing...");
  let browserPath;
  try {
    browserPath = await getBrowserPath(options);
    console.log(`✅ Browser ready at: ${browserPath}`);
  } catch (error) {
    await fail(error, 1, "Browser Preparation");
  }

  log("Setting up test environment");
  try {
    const resources = await setupTestEnvironment(options);
    // Store resources in module-level state
    state.resources = resources;

    // Track failures to determine final exit code
    let hasFailures = false;

    // Run the tests that weren't skipped
    if (!options.skipDev) {
      log("Starting development server");
      try {
        // Start the dev server first, store the stop function in resources
        const { url, stopDev } = await runDevServer(resources.targetDir);
        resources.stopDev = stopDev;
        state.resources.stopDev = stopDev;

        log("Running development server tests");
        await runDevTest(
          url,
          options.artifactDir,
          browserPath,
          options.headless !== false,
          options.bail,
          options.skipClient,
          options.realtime,
          options.skipHmr,
          options.skipStyleTests,
        );

        // Mark that dev tests have run successfully
        state.devTestsRan = true;

        // Update the overall dev test status to PASSED
        state.testStatus.dev.overall = "PASSED";
      } catch (error) {
        hasFailures = true;
        log("Error during development server testing: %O", error);
        console.error(
          `❌ Development server test failed: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Record the failure
        state.failures.push({
          step: "Development Server Test",
          error: error instanceof Error ? error.message : String(error),
          details:
            error instanceof Error && error.stack ? error.stack : undefined,
        });

        // Mark overall dev test status as FAILED
        state.testStatus.dev.overall = "FAILED";

        // If bail option is true, stop the tests
        if (options.bail) {
          await fail(error, 1, "Development Server Test");
        }

        // Otherwise, continue with the release test
        console.log(
          "Continuing with next tests since --bail is not enabled...",
        );
      }
    } else {
      log("Skipping development server tests");
    }

    if (!options.skipRelease) {
      if (options.realtime) {
        // If --realtime flag is set, status is already set in initializeTestStatus
        console.log(
          "⏩ Using realtime mode for Production tests (--realtime option enabled)",
        );
      } else {
        // Update status when release command runs
        try {
          console.log("\n🚀 Running release command smoke test");
          await runReleaseTest(
            options.artifactDir,
            resources,
            browserPath,
            options.headless !== false,
            options.bail,
            options.skipClient,
            options.projectDir,
            options.realtime,
            options.skipHmr,
            options.skipStyleTests,
          );
          // Update release command status to PASSED
          updateTestStatus("production", "releaseCommand", "PASSED");

          // Mark that release tests have run successfully
          state.releaseTestsRan = true;

          // Update the overall production test status to PASSED
          state.testStatus.production.overall = "PASSED";
        } catch (error) {
          // Update release command status to FAILED
          updateTestStatus("production", "releaseCommand", "FAILED");

          hasFailures = true;
          log("Error during release testing: %O", error);
          console.error(
            `❌ Release test failed: ${error instanceof Error ? error.message : String(error)}`,
          );

          // Record the failure
          state.failures.push({
            step: "Release Test",
            error: error instanceof Error ? error.message : String(error),
            details:
              error instanceof Error && error.stack ? error.stack : undefined,
          });

          // Mark overall production test status as FAILED
          state.testStatus.production.overall = "FAILED";

          // If bail option is true, stop the tests
          if (options.bail) {
            await fail(error, 1, "Release Test");
          }
        }
      }
    } else {
      log("Skipping release/production tests");
    }

    // Set the exit code based on whether there were failures
    if (hasFailures) {
      state.exitCode = 1;
      console.log(
        "\n⚠️ Some smoke tests failed, but continued running since --bail was not enabled.",
      );
    } else {
      console.log("\n✅ All smoke tests passed!");
    }

    // Call teardown with the final exit code
    await teardown();
  } catch (error) {
    await fail(error, 1, "Test Environment Setup");
  }
}
