import { createWriteStream, existsSync, mkdirSync } from "fs";
import { mkdirp, pathExists } from "fs-extra";
import * as fs from "fs/promises";
import { join } from "path";
import { log } from "./constants.mjs";
import { SmokeTestOptions, StreamCapturer } from "./types.mjs";

// Stream capturer for logging
export const capturer: StreamCapturer = {
  stdoutLogFile: null,
  stderrLogFile: null,
  combinedLogFile: null,
  // @ts-ignore - TS doesn't like this binding but it works as expected
  originalStdoutWrite: process.stdout.write.bind(process.stdout),
  // @ts-ignore - TS doesn't like this binding but it works as expected
  originalStderrWrite: process.stderr.write.bind(process.stderr),

  start(artifactDir: string) {
    // Create logs directory in the artifacts directory
    const logsDir = join(artifactDir, "logs");
    try {
      // Synchronously create directory to ensure it exists before writing
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      try {
        this.stdoutLogFile = createWriteStream(
          join(logsDir, `stdout-${timestamp}.log`),
          { flags: "a" },
        );
        this.stderrLogFile = createWriteStream(
          join(logsDir, `stderr-${timestamp}.log`),
          { flags: "a" },
        );
        this.combinedLogFile = createWriteStream(
          join(logsDir, `combined-${timestamp}.log`),
          { flags: "a" },
        );

        // Verify the streams are working
        this.stdoutLogFile.write("Log capture started\n");
        this.stderrLogFile.write("Log capture started\n");
        this.combinedLogFile.write("Log capture started\n");

        // Capture stdout
        // @ts-ignore - TS doesn't like dynamically modifying process streams
        process.stdout.write = (
          chunk: any,
          encoding?: BufferEncoding,
          callback?: (error?: Error | null) => void,
        ) => {
          if (this.stdoutLogFile && this.stdoutLogFile.writable)
            this.stdoutLogFile.write(chunk, encoding ?? "utf-8");
          if (this.combinedLogFile && this.combinedLogFile.writable)
            this.combinedLogFile.write(chunk, encoding ?? "utf-8");
          return this.originalStdoutWrite(chunk, encoding ?? "utf-8", callback);
        };

        // Capture stderr
        // @ts-ignore - TS doesn't like dynamically modifying process streams
        process.stderr.write = (
          chunk: any,
          encoding?: BufferEncoding,
          callback?: (error?: Error | null) => void,
        ) => {
          if (this.stderrLogFile && this.stderrLogFile.writable)
            this.stderrLogFile.write(chunk, encoding ?? "utf-8");
          if (this.combinedLogFile && this.combinedLogFile.writable)
            this.combinedLogFile.write(chunk, encoding ?? "utf-8");
          return this.originalStderrWrite(chunk, encoding ?? "utf-8", callback);
        };

        console.log(`📝 Log files created in ${logsDir}`);
      } catch (streamError) {
        console.error(`Failed to create log streams: ${streamError}`);
        // Clean up any partially created log files
        this.stop();
      }
    } catch (error) {
      console.error(`Failed to set up log capturing: ${error}`);
    }
  },

  stop() {
    // Restore original write functions
    // @ts-ignore - TS doesn't like dynamically modifying process streams
    process.stdout.write = this.originalStdoutWrite;
    // @ts-ignore - TS doesn't like dynamically modifying process streams
    process.stderr.write = this.originalStderrWrite;

    // Close log files
    if (this.stdoutLogFile) {
      try {
        this.stdoutLogFile.end();
      } catch (e) {
        console.error(`Error closing stdout log file: ${e}`);
      }
    }
    if (this.stderrLogFile) {
      try {
        this.stderrLogFile.end();
      } catch (e) {
        console.error(`Error closing stderr log file: ${e}`);
      }
    }
    if (this.combinedLogFile) {
      try {
        this.combinedLogFile.end();
      } catch (e) {
        console.error(`Error closing combined log file: ${e}`);
      }
    }

    this.stdoutLogFile = null;
    this.stderrLogFile = null;
    this.combinedLogFile = null;
  },
};

/**
 * Sets up the artifacts directory with a clean structure
 */
export async function setupArtifactsDirectory(
  artifactDir: string,
  options?: SmokeTestOptions,
): Promise<void> {
  log("Setting up artifacts directory: %s", artifactDir);
  console.log(`📁 Setting up artifacts directory: ${artifactDir}`);

  // Check if directory exists
  const exists = await pathExists(artifactDir);
  if (exists) {
    log("Artifacts directory already exists, removing it");
    console.log(`🧹 Cleaning existing artifacts directory`);
    try {
      await fs.rm(artifactDir, { recursive: true, force: true });
    } catch (error) {
      log("Error removing existing artifacts directory: %O", error);
      console.error(
        `⚠️ Could not remove existing artifacts directory: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-fatal error, continue
    }
  }

  // Create main artifacts directory
  await mkdirp(artifactDir);
  log("Created artifacts directory: %s", artifactDir);

  // Create standard subdirectories
  const subdirs = ["screenshots", "reports", "logs"];

  // Only create project directory if copyProject is enabled
  if (options?.copyProject) {
    subdirs.push("project");
  }

  for (const subdir of subdirs) {
    const dirPath = join(artifactDir, subdir);
    await mkdirp(dirPath);
    log("Created artifacts subdirectory: %s", dirPath);
  }

  console.log(`✅ Artifacts directory structure created`);

  // Ensure logs directory exists and has correct permissions before capturing logs
  try {
    const logsDir = join(artifactDir, "logs");
    // Double-check permissions by writing a test file
    const testLogPath = join(logsDir, "test-log-permissions.txt");
    await fs.writeFile(testLogPath, "Testing log directory permissions\n");
    await fs.unlink(testLogPath);
    log("Log directory permissions verified");
  } catch (error) {
    log("Error verifying log directory permissions: %O", error);
    console.error(
      `⚠️ Warning: Log directory permissions issue: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Not fatal, try to proceed anyway
  }

  // Start capturing logs
  capturer.start(artifactDir);
}

/**
 * Helper function to take and save a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: any,
  url: string,
  artifactDir: string,
  status: string,
): Promise<void> {
  // Use the standardized screenshots directory
  const screenshotsDir = join(artifactDir, "screenshots");
  log("Saving screenshot to: %s", screenshotsDir);

  // Create a more descriptive filename with timestamp and test result
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const urlIdentifier = new URL(url).hostname.replace(/\./g, "-");
  const screenshotPath = join(
    screenshotsDir,
    `smoke-test-${urlIdentifier}-${status}-${timestamp}.png`,
  );

  log("Taking screenshot: %s", screenshotPath);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to ${screenshotPath}`);
}
