import { mkdirp } from "fs-extra";
import { setTimeout } from "node:timers/promises";
import { join } from "path";
import { cleanupResources } from "./cleanup.mjs";
import { log } from "./constants.mjs";
import { generateFinalReport } from "./reporting.mjs";
import { state } from "./state.mjs";

// Re-export log from constants
export { log };

// Helper function to detect if running in CI environment
export function isRunningInCI(ciFlag = false): boolean {
  return (
    ciFlag ||
    !!process.env.CI ||
    !!process.env.GITHUB_ACTIONS ||
    !!process.env.GITLAB_CI ||
    !!process.env.CIRCLECI
  );
}

/**
 * Handles test failure by logging the error and initiating teardown
 */
export async function fail(
  error: unknown,
  exitCode = 1,
  step?: string,
): Promise<never> {
  state.exitCode = exitCode;
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`❌ Smoke test failed: ${msg}`);
  log("Test failed with error: %O", error);

  // Record the failure if a step is provided
  if (step) {
    // Determine the environment context if not explicitly in the step name
    let enhancedStep = step;
    if (
      !step.toLowerCase().includes("development") &&
      !step.toLowerCase().includes("production") &&
      !step.toLowerCase().includes("dev server")
    ) {
      // For server/client side tests with phase info, add environment context
      const isInReleasePhase =
        state.failures.some(
          (f) =>
            f.step.includes("Release Command") ||
            f.step.includes("Release Test"),
        ) || state.options.skipDev; // If dev is skipped, we're in release phase

      if (isInReleasePhase) {
        enhancedStep = `Production - ${step}`;
      } else {
        enhancedStep = `Development - ${step}`;
      }
    }

    state.failures.push({
      step: enhancedStep,
      error: msg,
      details: error instanceof Error && error.stack ? error.stack : undefined,
    });
  }

  // Ensure artifactDir exists if it's defined but hasn't been created yet
  if (state.options.artifactDir) {
    try {
      // Create the main artifacts directory and reports subdirectory if they don't exist
      await mkdirp(state.options.artifactDir);
      await mkdirp(join(state.options.artifactDir, "reports"));
      log("Ensured artifact directories exist before teardown");
    } catch (dirError) {
      log("Error ensuring artifact directories exist: %O", dirError);
      // Non-fatal, continue to teardown
    }
  }

  try {
    // Generate a report before starting teardown to ensure we have at least one report
    await generateFinalReport();

    // Then proceed with teardown
    await teardown();
  } catch (teardownError) {
    // If teardown itself fails, log the error
    console.error(
      `Error during teardown: ${teardownError instanceof Error ? teardownError.message : String(teardownError)}`,
    );

    // Set a short timeout to allow any pending operations to complete
    await setTimeout(500);
  }

  // Set a short delay to allow report to be written
  await setTimeout(500);

  return process.exit(exitCode) as never;
}

/**
 * Handles resource teardown and exits the process with appropriate exit code
 */
export async function teardown(): Promise<void> {
  // Prevent multiple teardowns running simultaneously
  if (state.isTearingDown) {
    log("Teardown already in progress, skipping duplicate call");
    return;
  }

  state.isTearingDown = true;
  log("Starting teardown process with exit code: %d", state.exitCode);

  try {
    // First, generate a report, before any cleanup happens
    // This ensures we have at least some report even if cleanup fails
    await generateFinalReport();

    // Then try to cleanup resources
    try {
      await cleanupResources(state.resources, state.options);
      log("Resource cleanup completed successfully");
    } catch (cleanupError) {
      log("Error during resource cleanup: %O", cleanupError);
      console.error(
        `Error during resource cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );

      // Add this error to our failures list
      state.failures.push({
        step: "Resource Cleanup",
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
        details:
          cleanupError instanceof Error && cleanupError.stack
            ? cleanupError.stack
            : undefined,
      });

      // Set exit code to 1 if it wasn't already set
      if (state.exitCode === 0) state.exitCode = 1;
    }
  } catch (error) {
    log("Error during teardown: %O", error);
    console.error(
      `Error during teardown: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Set exit code to 1 if it wasn't already set
    if (state.exitCode === 0) state.exitCode = 1;

    // Try generating report even if an error occurred
    try {
      await generateFinalReport();
    } catch (reportError) {
      console.error(
        "Failed to generate report after teardown error:",
        reportError,
      );
    }
  } finally {
    // Make sure log capturing is stopped before exiting
    log("Log capturing stopped during teardown");

    process.exit(state.exitCode);
  }
}

/**
 * Formats the path suffix from a custom path
 */
export function formatPathSuffix(customPath?: string): string {
  const suffix = customPath
    ? customPath.startsWith("/")
      ? customPath
      : `/${customPath}`
    : "";

  log("Formatted path suffix: %s", suffix);
  return suffix;
}

/**
 * Wraps an async function with retry logic.
 * @param fn The async function to execute.
 * @param description A description of the operation for logging.
 * @param beforeRetry A function to run before each retry attempt.
 * @param maxRetries The maximum number of retries.
 * @param delay The delay between retries in milliseconds.
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  description: string,
  beforeRetry?: () => Promise<void>,
  maxRetries = 5,
  delay = 2000,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0 && beforeRetry) {
        log(`Running beforeRetry hook for "${description}"`);
        await beforeRetry();
      }
      return await fn();
    } catch (error) {
      log(
        `Attempt ${i + 1} of ${maxRetries} failed for "${description}": ${error instanceof Error ? error.message : String(error)}`,
      );
      if (i === maxRetries - 1) {
        log(`All ${maxRetries} retries failed for "${description}".`);
        throw error;
      }
      log(`Retrying in ${delay}ms...`);
      await setTimeout(delay);
    }
  }
  throw new Error("Retry loop failed unexpectedly.");
}
