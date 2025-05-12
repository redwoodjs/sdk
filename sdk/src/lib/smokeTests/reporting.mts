import { join, basename } from "path";
import { writeFile } from "fs/promises";
import { mkdirp } from "fs-extra";
import { log } from "./constants.mjs";
import { state } from "./state.mjs";
import { SmokeTestResult } from "./types.mjs";

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

    // Add hierarchical test results overview
    console.log("\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
    console.log("┃          🔍 TEST RESULTS SUMMARY        ┃");
    console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");

    // Group failures by step to determine which stages had issues
    const devFailures = state.failures.filter((f) =>
      failureMatches(f, ["Development", "Development Server", "Development -"]),
    );

    const releaseFailures = state.failures.filter((f) =>
      failureMatches(f, ["Production", "Release", "Production -"]),
    );

    // More specific test stage failures - for dev environment
    const serverSideInitialDevFailures = state.failures.filter((f) =>
      failureMatches(f, ["Server-side", "Initial"], ["Production"]),
    );

    const clientSideInitialDevFailures = state.failures.filter((f) =>
      failureMatches(f, ["Client-side", "Initial"], ["Production"]),
    );

    const serverSideRealtimeDevFailures = state.failures.filter((f) =>
      failureMatches(f, ["Server-side", "Post-upgrade"], ["Production"]),
    );

    const clientSideRealtimeDevFailures = state.failures.filter((f) =>
      failureMatches(f, ["Client-side", "Post-upgrade"], ["Production"]),
    );

    const realtimeUpgradeDevFailures = state.failures.filter((f) =>
      failureMatches(f, ["Realtime Upgrade"], ["Production"]),
    );

    // For production environment
    const serverSideInitialProdFailures = state.failures.filter((f) =>
      failureMatches(f, ["Server-side", "Initial", "Production"]),
    );

    const clientSideInitialProdFailures = state.failures.filter((f) =>
      failureMatches(f, ["Client-side", "Initial", "Production"]),
    );

    const serverSideRealtimeProdFailures = state.failures.filter((f) =>
      failureMatches(f, ["Server-side", "Post-upgrade", "Production"]),
    );

    const clientSideRealtimeProdFailures = state.failures.filter((f) =>
      failureMatches(f, ["Client-side", "Post-upgrade", "Production"]),
    );

    const realtimeUpgradeProdFailures = state.failures.filter((f) =>
      failureMatches(f, ["Realtime Upgrade", "Production"]),
    );

    const releaseCommandFailures = state.failures.filter((f) =>
      failureMatches(f, ["Release Command"]),
    );

    // Dev tests summary
    if (report.options.skipDev) {
      console.log("● Development Tests: ⏩ SKIPPED");
    } else if (state.devTestsRan === false && !devFailures.length) {
      console.log("● Development Tests: ⚠️ DID NOT RUN");
    } else {
      console.log(
        `● Development Tests: ${devFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
      );
      console.log(`  ├─ Initial Tests:`);
      console.log(
        `  │  ├─ Server-side: ${serverSideInitialDevFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
      );
      console.log(
        `  │  └─ Client-side: ${clientSideInitialDevFailures.length > 0 ? "❌ FAILED" : report.options.skipClient ? "⏩ SKIPPED" : "✅ PASSED"}`,
      );
      console.log(`  └─ Realtime Tests:`);
      console.log(
        `     ├─ Upgrade: ${realtimeUpgradeDevFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
      );
      console.log(
        `     ├─ Server-side: ${serverSideRealtimeDevFailures.length > 0 ? "❌ FAILED" : realtimeUpgradeDevFailures.length > 0 ? "⏩ SKIPPED" : "✅ PASSED"}`,
      );
      console.log(
        `     └─ Client-side: ${clientSideRealtimeDevFailures.length > 0 ? "❌ FAILED" : realtimeUpgradeDevFailures.length > 0 || report.options.skipClient ? "⏩ SKIPPED" : "✅ PASSED"}`,
      );
    }

    // Release tests summary
    if (report.options.skipRelease) {
      console.log("● Production Tests: ⏩ SKIPPED");
    } else if (state.releaseTestsRan === false && !releaseFailures.length) {
      console.log("● Production Tests: ⚠️ DID NOT RUN");
    } else {
      console.log(
        `● Production Tests: ${releaseFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
      );
      console.log(
        `  ├─ Release Command: ${releaseCommandFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
      );

      // Only show these if release command succeeded
      if (releaseCommandFailures.length === 0) {
        console.log(`  ├─ Initial Tests:`);
        console.log(
          `  │  ├─ Server-side: ${serverSideInitialProdFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
        );
        console.log(
          `  │  └─ Client-side: ${clientSideInitialProdFailures.length > 0 ? "❌ FAILED" : report.options.skipClient ? "⏩ SKIPPED" : "✅ PASSED"}`,
        );
        console.log(`  └─ Realtime Tests:`);
        console.log(
          `     ├─ Upgrade: ${realtimeUpgradeProdFailures.length > 0 ? "❌ FAILED" : "✅ PASSED"}`,
        );
        console.log(
          `     ├─ Server-side: ${serverSideRealtimeProdFailures.length > 0 ? "❌ FAILED" : realtimeUpgradeProdFailures.length > 0 ? "⏩ SKIPPED" : "✅ PASSED"}`,
        );
        console.log(
          `     └─ Client-side: ${clientSideRealtimeProdFailures.length > 0 ? "❌ FAILED" : realtimeUpgradeProdFailures.length > 0 || report.options.skipClient ? "⏩ SKIPPED" : "✅ PASSED"}`,
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
 * Report the smoke test result
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
    throw new Error(
      `${environment} - ${phasePrefix}${type} smoke test failed. Status: ${result.status}${result.error ? `. Error: ${result.error}` : ""}`,
    );
  }
}
