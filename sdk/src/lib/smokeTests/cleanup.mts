import { join } from "path";
import { setTimeout } from "node:timers/promises";
import { pathExists } from "fs-extra";
import { mkdirp } from "fs-extra";
import * as fs from "fs/promises";
import { copy } from "fs-extra";
import { relative } from "path";
import ignore from "ignore";
import { log } from "./constants.mjs";
import { deleteWorker } from "./release.mjs";
import { isRunningInCI } from "./utils.mjs";
import { SmokeTestOptions, TestResources } from "./types.mjs";
import { capturer } from "./artifacts.mjs";
import { state } from "./state.mjs";

/**
 * Cleans up any resources used during testing
 */
export async function cleanupResources(
  resources: TestResources,
  options: SmokeTestOptions,
): Promise<void> {
  log("Cleaning up resources");

  const inCIMode = isRunningInCI(options.ci);

  // Stop dev server if it was started
  if (resources.stopDev) {
    console.log("Stopping development server...");
    try {
      // Set a timeout for the stopDev function
      const stopTimeout = 10000; // 10 seconds
      await Promise.race([
        resources.stopDev(),
        (async () => {
          await setTimeout(stopTimeout);
          log("Timed out waiting for dev server to stop, continuing cleanup");
          console.log("⚠️ Timed out waiting for development server to stop");

          // Record this issue
          state.failures.push({
            step: "Development Server Shutdown",
            error:
              "Timed out waiting for development server to stop after 10 seconds",
          });

          // If the dev server didn't stop in time, we'll continue with cleanup
          return null;
        })(),
      ]);
    } catch (error) {
      log("Error while stopping development server: %O", error);
      console.error(
        `Error while stopping development server: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Development Server Shutdown",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  }

  // Clean up resources
  if (resources.workerName && resources.workerCreatedDuringTest) {
    console.log(`🧹 Cleaning up: Deleting worker ${resources.workerName}...`);
    try {
      await deleteWorker(resources.workerName, resources.targetDir);
    } catch (error) {
      log("Error while deleting worker: %O", error);
      console.error(
        `Error while deleting worker: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: `Worker Deletion: ${resources.workerName}`,
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  } else if (resources.workerName) {
    log(
      "Not deleting worker %s as it was not created during this test",
      resources.workerName,
    );
  }

  // Always copy test directory to artifact directory if targetDir exists
  if (resources.targetDir && options.artifactDir) {
    try {
      // Use the standardized project directory
      const projectDir = join(options.artifactDir, "project");
      // Ensure directory exists
      await mkdirp(projectDir);

      // Use a simple project directory name without timestamp
      const testResult = state.exitCode === 0 ? "passed" : "failed";
      const artifactTargetDir = projectDir;

      log(
        "Copying test directory to artifacts: %s → %s",
        resources.targetDir,
        artifactTargetDir,
      );
      console.log(
        `📦 Copying test directory to artifacts: ${artifactTargetDir}`,
      );

      // Remove existing project directory if it exists
      if (await pathExists(artifactTargetDir)) {
        await fs.rm(artifactTargetDir, { recursive: true, force: true });
      }

      // Create gitignore filter for copying to artifacts
      let ig = ignore();
      const gitignorePath = join(resources.targetDir, ".gitignore");

      if (await pathExists(gitignorePath)) {
        log("Found .gitignore file at %s", gitignorePath);
        const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
        ig = ig.add(gitignoreContent);
      } else {
        log("No .gitignore found, using default ignore patterns");
        // Add default ignores if no .gitignore exists
        ig = ig.add(
          [
            "node_modules",
            ".git",
            "dist",
            "build",
            ".DS_Store",
            "coverage",
            ".cache",
            ".wrangler",
            ".env",
          ].join("\n"),
        );
      }

      // Copy project directory respecting the .gitignore
      await copy(resources.targetDir, artifactTargetDir, {
        filter: (src) => {
          // Get path relative to project directory
          const relativePath = relative(resources.targetDir!, src);
          if (!relativePath) return true; // Include the root directory

          // Check against ignore patterns
          const result = !ig.ignores(relativePath);
          return result;
        },
      });

      log("Project directory copied successfully");
      console.log(
        `✅ Test directory copied to artifacts: ${artifactTargetDir}`,
      );
    } catch (error) {
      log("Error copying test directory to artifacts: %O", error);
      console.error(
        `Error copying test directory to artifacts: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Artifact Copy",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  }

  // Clean up temporary directory only if keep flag is false and not in CI mode
  if (resources.tempDirCleanup && !options.keep && !inCIMode) {
    log("Cleaning up temporary directory");
    try {
      await resources.tempDirCleanup();
      log("Temporary directory cleaned up");
    } catch (error) {
      log("Error while cleaning up temporary directory: %O", error);
      console.error(
        `Error while cleaning up temporary directory: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "Temporary Directory Cleanup",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }
  } else if (resources.tempDirCleanup && resources.targetDir) {
    console.log(
      `📂 Keeping temporary directory for inspection: ${resources.targetDir}`,
    );
  }

  log("Resource cleanup completed");

  // At the end of cleanup, stop log capturing
  capturer.stop();
  log("Log capturing stopped");
}
