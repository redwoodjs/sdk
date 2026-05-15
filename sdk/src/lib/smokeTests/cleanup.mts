import { copy, mkdirp, pathExists } from "fs-extra";
import * as fs from "fs/promises";
import ignore from "ignore";
import { setTimeout } from "node:timers/promises";
import { join, relative } from "path";
import { capturer } from "./artifacts.mjs";
import { log } from "./constants.mjs";
import { deleteD1Database, deleteWorker, listD1Databases } from "./release.mjs";
import { state } from "./state.mjs";
import { SmokeTestOptions, TestResources } from "./types.mjs";
import { isRunningInCI } from "./utils.mjs";

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

  // Clean up resources only if release tests have run
  if (resources.workerName && state.releaseTestsRan) {
    // First, clean up any D1 databases associated with this worker
    try {
      log(
        `Finding D1 databases associated with worker ${resources.workerName}`,
      );
      console.log(
        `🔍 Looking for D1 databases associated with worker ${resources.workerName}...`,
      );

      const databases = await listD1Databases(resources.targetDir);

      // Look for databases that contain the unique resource key
      const resourceUniqueKey = resources.resourceUniqueKey;
      const relatedDatabases = databases.filter((db) =>
        db.name.includes(resourceUniqueKey),
      );

      log(
        `Found ${relatedDatabases.length} related D1 databases with unique key: ${resourceUniqueKey}`,
      );

      if (relatedDatabases.length > 0) {
        console.log(
          `Found ${relatedDatabases.length} D1 database(s) to clean up`,
        );

        for (const db of relatedDatabases) {
          try {
            log(`Deleting D1 database: ${db.name}`);
            await deleteD1Database(
              db.name,
              resources.targetDir || "", // Provide empty string as fallback
              resourceUniqueKey,
            );
          } catch (dbError) {
            log("Error while deleting D1 database: %O", dbError);
            console.error(
              `Error while deleting D1 database: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
            );

            // Record this issue
            state.failures.push({
              step: `D1 Database Deletion: ${db.name}`,
              error:
                dbError instanceof Error ? dbError.message : String(dbError),
              details:
                dbError instanceof Error && dbError.stack
                  ? dbError.stack
                  : undefined,
            });
          }
        }
      } else {
        log("No related D1 databases found to clean up");
      }
    } catch (error) {
      log("Error finding D1 databases: %O", error);
      console.error(
        `Error finding D1 databases: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Record this issue
      state.failures.push({
        step: "D1 Database Lookup",
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof Error && error.stack ? error.stack : undefined,
      });
    }

    // Now delete the worker
    console.log(`🧹 Cleaning up: Deleting worker ${resources.workerName}...`);
    try {
      await deleteWorker(
        resources.workerName,
        resources.targetDir || "", // Provide empty string as fallback
        resources.resourceUniqueKey,
      );
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
  } else if (resources.workerName && !state.releaseTestsRan) {
    log(
      "Skipping worker and D1 database cleanup because release tests did not run",
    );
    console.log(
      "⏭️ Skipping worker and D1 database cleanup (release tests did not run)",
    );
  } else {
    log("No worker name provided for cleanup");
  }

  // Always copy test directory to artifact directory if targetDir exists
  if (resources.targetDir && options.artifactDir && options.copyProject) {
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
