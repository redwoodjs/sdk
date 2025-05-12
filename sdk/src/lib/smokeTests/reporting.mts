import { join, basename } from "path";
import { writeFile } from "fs/promises";
import { mkdirp } from "fs-extra";
import { log } from "./constants.mjs";
import { state, TestStatusValue } from "./state.mjs";
import { SmokeTestResult } from "./types.mjs";

/**
 * Maps a test status to a display string with emoji
 */
function formatTestStatus(status: TestStatusValue): string {
  switch (status) {
    case "PASSED":
      return "✅ PASSED";
    case "FAILED":
      return "❌ FAILED";
    case "SKIPPED":
      return "⏩ SKIPPED";
    case "DID_NOT_RUN":
      return "⚠️ DID NOT RUN";
    default:
      return "❓ UNKNOWN";
  }
}

/**
 * Generates the final test report without doing any resource cleanup.
 */
export async function generateFinalReport(): Promise<void> {
  try {
    // Helper function to check if a failure matches the specified patterns
    function failureMatches(
      failure: { step: string; error?: string },
      patterns: string[],
      notPatterns: string[] = [],
    ): boolean {
      // Check if any of the patterns match in either step or error
      const matchesPattern = patterns.some(
        (pattern) =>
          failure.step.includes(pattern) ||
          (failure.error && failure.error.includes(pattern)),
      );

      // Check if any of the not-patterns match in either step or error
      const matchesNotPattern = notPatterns.some(
        (pattern) =>
          failure.step.includes(pattern) ||
          (failure.error && failure.error.includes(pattern)),
      );

      // Return true if it matches a pattern and doesn't match any not-pattern
      return matchesPattern && !matchesNotPattern;
    }

    // Create a report object
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const report = {
      timestamp,
      success: state.exitCode === 0,
      exitCode: state.exitCode,
      workerName: (state.resources.workerName || null) as string | null,
      projectDir: state.options.artifactDir
        ? join(state.options.artifactDir, "project")
        : null,
      logFiles: state.options.artifactDir
        ? {
            stdout: join(
              state.options.artifactDir,
              "logs",
              `stdout-${timestamp}.log`,
            ),
            stderr: join(
              state.options.artifactDir,
              "logs",
              `stderr-${timestamp}.log`,
            ),
            combined: join(
              state.options.artifactDir,
              "logs",
              `combined-${timestamp}.log`,
            ),
          }
        : null,
      failures: state.failures,
      options: {
        customPath: state.options.customPath,
        skipDev: state.options.skipDev,
        skipRelease: state.options.skipRelease,
        skipClient: state.options.skipClient,
      },
      testStatus: state.testStatus,
    };

    // Always print the report to console in a pretty format
    console.log("\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
    console.log("┃          📊 SMOKE TEST REPORT          ┃");
    console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
    console.log("┌──────────────────────────────────────┐");
    console.log(`│ Timestamp: ${timestamp}`);

    console.log(`│ Status: ${report.success ? "✅ PASSED" : "❌ FAILED"}`);

    console.log(`│ Exit code: ${state.exitCode}`);
    if (report.workerName) {
      console.log(`│ Worker name: ${report.workerName}`);
    }
    console.log(`│ Test options:`);
    console.log(`│   - Custom path: ${report.options.customPath || "/"}`);
    console.log(`│   - Skip dev: ${report.options.skipDev ? "Yes" : "No"}`);
    console.log(
      `│   - Skip release: ${report.options.skipRelease ? "Yes" : "No"}`,
    );
    console.log(
      `│   - Skip client: ${report.options.skipClient ? "Yes" : "No"}`,
    );

    // Add info about log files
    if (report.logFiles) {
      console.log(`│ Log files:`);
      console.log(`│   - stdout: ${basename(report.logFiles.stdout)}`);
      console.log(`│   - stderr: ${basename(report.logFiles.stderr)}`);
      console.log(`│   - combined: ${basename(report.logFiles.combined)}`);
    }

    console.log("└──────────────────────────────────────┘");

    // Add summary of failures count
    if (state.failures.length > 0) {
      console.log(`\n❌ Failed tests: ${state.failures.length}`);
    } else if (report.success) {
      console.log("\n✅ All smoke tests passed successfully!");
    }

    // Group failures by step to determine which stages had issues
    const devFailures = state.failures.filter((f) =>
      failureMatches(f, ["Development", "Development Server", "Development -"]),
    );

    const releaseFailures = state.failures.filter((f) =>
      failureMatches(f, ["Production", "Release", "Production -"]),
    );

    // Add hierarchical test results overview
    console.log("\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
    console.log("┃          🔍 TEST RESULTS SUMMARY        ┃");
    console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");

    // Dev tests summary using the new testStatus system
    console.log(
      `● Development Tests: ${formatTestStatus(state.testStatus.dev.overall)}`,
    );

    // Only show details if the overall test status is not "SKIPPED" or "DID_NOT_RUN"
    if (
      state.testStatus.dev.overall !== "SKIPPED" &&
      state.testStatus.dev.overall !== "DID_NOT_RUN"
    ) {
      console.log(`  ├─ Initial Tests:`);
      console.log(
        `  │  ├─ Server-side: ${formatTestStatus(state.testStatus.dev.initialServerSide)}`,
      );
      console.log(
        `  │  └─ Client-side: ${formatTestStatus(state.testStatus.dev.initialClientSide)}`,
      );
      console.log(`  └─ Realtime Tests:`);
      console.log(
        `     ├─ Upgrade: ${formatTestStatus(state.testStatus.dev.realtimeUpgrade)}`,
      );
      console.log(
        `     ├─ Server-side: ${formatTestStatus(state.testStatus.dev.realtimeServerSide)}`,
      );
      console.log(
        `     └─ Client-side: ${formatTestStatus(state.testStatus.dev.realtimeClientSide)}`,
      );
    }

    // Production tests summary using the new testStatus system
    console.log(
      `● Production Tests: ${formatTestStatus(state.testStatus.production.overall)}`,
    );

    // Only show details if the overall test status is not "SKIPPED" or "DID_NOT_RUN"
    if (
      state.testStatus.production.overall !== "SKIPPED" &&
      state.testStatus.production.overall !== "DID_NOT_RUN"
    ) {
      console.log(
        `  ├─ Release Command: ${formatTestStatus(state.testStatus.production.releaseCommand)}`,
      );

      // Only show these if release command was either not run or passed
      if (state.testStatus.production.releaseCommand !== "FAILED") {
        console.log(`  ├─ Initial Tests:`);
        console.log(
          `  │  ├─ Server-side: ${formatTestStatus(state.testStatus.production.initialServerSide)}`,
        );
        console.log(
          `  │  └─ Client-side: ${formatTestStatus(state.testStatus.production.initialClientSide)}`,
        );
        console.log(`  └─ Realtime Tests:`);
        console.log(
          `     ├─ Upgrade: ${formatTestStatus(state.testStatus.production.realtimeUpgrade)}`,
        );
        console.log(
          `     ├─ Server-side: ${formatTestStatus(state.testStatus.production.realtimeServerSide)}`,
        );
        console.log(
          `     └─ Client-side: ${formatTestStatus(state.testStatus.production.realtimeClientSide)}`,
        );
      } else {
        console.log(`  └─ Tests: ⏩ SKIPPED (release command failed)`);
      }
    }

    // Add failures to the report file if we have a valid artifactDir
    if (state.options.artifactDir) {
      try {
        // Ensure the directory exists, even if it was not created earlier
        await mkdirp(state.options.artifactDir);

        // Use the standardized reports directory
        const reportDir = join(state.options.artifactDir, "reports");
        // Ensure the directory exists
        await mkdirp(reportDir);

        const reportPath = join(
          reportDir,
          `smoke-test-report-${timestamp}.json`,
        );

        await writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📝 Report saved to ${reportPath}`);
      } catch (reportError) {
        console.error(
          `⚠️ Could not save report to file: ${reportError instanceof Error ? reportError.message : String(reportError)}`,
        );
      }
    } else {
      console.log(
        "\n⚠️ No artifacts directory specified, report not saved to disk",
      );
    }

    // Report failures with clear environment context
    if (state.failures.length > 0) {
      console.log("\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
      console.log("┃        🔍 FAILURE DETAILS             ┃");
      console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");

      // Group failures by environment (Dev vs Release)
      if (devFailures.length > 0) {
        console.log("┌─────────── DEVELOPMENT ENVIRONMENT ───────────┐");
        devFailures.forEach((failure, index) => {
          console.log(`│ Failure #${index + 1}: ${failure.step}`);

          // Split error message into lines if it's long
          const errorLines = failure.error.split("\n");
          console.log(`│ Error: ${errorLines[0]}`);
          for (let i = 1; i < errorLines.length; i++) {
            console.log(`│        ${errorLines[i]}`);
          }
          console.log(`│`);
        });
        console.log(`└────────────────────────────────────┘`);
      }

      if (releaseFailures.length > 0) {
        console.log("┌─────────── PRODUCTION ENVIRONMENT ───────────┐");
        releaseFailures.forEach((failure, index) => {
          console.log(`│ Failure #${index + 1}: ${failure.step}`);

          // Split error message into lines if it's long
          const errorLines = failure.error.split("\n");
          console.log(`│ Error: ${errorLines[0]}`);
          for (let i = 1; i < errorLines.length; i++) {
            console.log(`│        ${errorLines[i]}`);
          }
          console.log(`│`);
        });
        console.log(`└────────────────────────────────────┘`);
      }

      // Show other failures that don't fit into the above categories
      const otherFailures = state.failures.filter(
        (f) => !devFailures.includes(f) && !releaseFailures.includes(f),
      );

      if (otherFailures.length > 0) {
        console.log("┌─────────── OTHER FAILURES ───────────┐");
        otherFailures.forEach((failure, index) => {
          console.log(`│ Failure #${index + 1}: ${failure.step}`);

          // Split error message into lines if it's long
          const errorLines = failure.error.split("\n");
          console.log(`│ Error: ${errorLines[0]}`);
          for (let i = 1; i < errorLines.length; i++) {
            console.log(`│        ${errorLines[i]}`);
          }
          console.log(`│`);
        });
        console.log(`└────────────────────────────────────┘`);
      }
    }
  } catch (error) {
    // Last resort error handling
    console.error("❌ Failed to generate report:", error);
  }
}

/**
 * Updates the test status in the state object and reports the result.
 */
export function reportSmokeTestResult(
  result: SmokeTestResult,
  type: string,
  phase: string = "",
  environment: string = "Development", // Add environment parameter with default
): void {
  const phasePrefix = phase ? `(${phase}) ` : "";
  log("Reporting %s%s smoke test result: %O", phasePrefix, type, result);

  if (result.verificationPassed) {
    console.log(`✅ ${phasePrefix}${type} smoke test passed!`);
    if (result.serverTimestamp) {
      console.log(`✅ Server timestamp: ${result.serverTimestamp}`);
    }
    if (result.clientTimestamp) {
      console.log(`✅ Client timestamp: ${result.clientTimestamp}`);
    }
  } else {
    log(
      "ERROR: %s%s smoke test failed. Status: %s. Error: %s",
      phasePrefix,
      type,
      result.status,
      result.error || "unknown",
    );

    // The actual state update and error throwing is now handled by the caller functions
    // We only need to report the result in the console
    console.error(
      `❌ ${phasePrefix}${type} smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`,
    );
  }
}

/**
 * Initialize test statuses based on test options
 */
export function initializeTestStatus(): void {
  // Set default status for all tests as "DID_NOT_RUN"
  // Dev tests
  state.testStatus.dev.overall = "DID_NOT_RUN";
  state.testStatus.dev.initialServerSide = "DID_NOT_RUN";
  state.testStatus.dev.initialClientSide = "DID_NOT_RUN";
  state.testStatus.dev.realtimeUpgrade = "DID_NOT_RUN";
  state.testStatus.dev.realtimeServerSide = "DID_NOT_RUN";
  state.testStatus.dev.realtimeClientSide = "DID_NOT_RUN";

  // Production tests
  state.testStatus.production.overall = "DID_NOT_RUN";
  state.testStatus.production.releaseCommand = "DID_NOT_RUN";
  state.testStatus.production.initialServerSide = "DID_NOT_RUN";
  state.testStatus.production.initialClientSide = "DID_NOT_RUN";
  state.testStatus.production.realtimeUpgrade = "DID_NOT_RUN";
  state.testStatus.production.realtimeServerSide = "DID_NOT_RUN";
  state.testStatus.production.realtimeClientSide = "DID_NOT_RUN";

  // Now override with specific statuses based on options

  // Mark skipped tests based on options
  if (state.options.skipDev) {
    state.testStatus.dev.overall = "SKIPPED";
    state.testStatus.dev.initialServerSide = "SKIPPED";
    state.testStatus.dev.initialClientSide = "SKIPPED";
    state.testStatus.dev.realtimeUpgrade = "SKIPPED";
    state.testStatus.dev.realtimeServerSide = "SKIPPED";
    state.testStatus.dev.realtimeClientSide = "SKIPPED";
  }

  if (state.options.skipRelease) {
    state.testStatus.production.overall = "SKIPPED";
    state.testStatus.production.releaseCommand = "SKIPPED";
    state.testStatus.production.initialServerSide = "SKIPPED";
    state.testStatus.production.initialClientSide = "SKIPPED";
    state.testStatus.production.realtimeUpgrade = "SKIPPED";
    state.testStatus.production.realtimeServerSide = "SKIPPED";
    state.testStatus.production.realtimeClientSide = "SKIPPED";
  }

  if (state.options.skipClient) {
    state.testStatus.dev.initialClientSide = "SKIPPED";
    state.testStatus.dev.realtimeClientSide = "SKIPPED";
    state.testStatus.production.initialClientSide = "SKIPPED";
    state.testStatus.production.realtimeClientSide = "SKIPPED";
  }

  // Handle realtime option which skips initial tests
  if (state.options.realtime) {
    // In realtime mode, initial tests are skipped
    if (!state.options.skipDev) {
      state.testStatus.dev.initialServerSide = "SKIPPED";
      state.testStatus.dev.initialClientSide = "SKIPPED";
      // Set the upgrade test to PASSED as it's implicitly run for realtime mode
      state.testStatus.dev.realtimeUpgrade = "PASSED";
    }

    if (!state.options.skipRelease) {
      state.testStatus.production.initialServerSide = "SKIPPED";
      state.testStatus.production.initialClientSide = "SKIPPED";
      // Set release command to PASSED since it must have succeeded for realtime tests to run
      state.testStatus.production.releaseCommand = "PASSED";
      // Set the upgrade test to PASSED as it's implicitly run for realtime mode
      state.testStatus.production.realtimeUpgrade = "PASSED";
    }
  }
}
