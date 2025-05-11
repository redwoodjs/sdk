import { join } from "path";
import { setTimeout } from "node:timers/promises";
import { log } from "./constants.mjs";
import { checkUrl, checkServerUp } from "./browser.mjs";
import { TestResources } from "./types.mjs";
import { $ } from "../../lib/$.mjs";
import { execaCommand } from "execa";
import { existsSync, readFileSync } from "fs";

// The $expect utility function from utils.mts
interface ExpectOptions {
  expect: string | RegExp;
  send?: string;
}

interface ExpectResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * A mini expect-like utility for handling interactive CLI prompts and verifying output
 * @param command The command to execute
 * @param expectations Array of {expect, send} objects for interactive responses and verification
 * @param cwd Working directory for command execution
 * @param options Additional options for command execution
 * @returns Promise that resolves when the command completes
 */
export async function $expect(
  command: string,
  expectations: Array<ExpectOptions>,
  cwd?: string,
  options: { reject: boolean } = { reject: true },
): Promise<ExpectResult> {
  return new Promise((resolve, reject) => {
    log("$expect starting with command: %s", command);
    log("Working directory: %s", cwd ?? process.cwd());
    log(
      "Expected patterns: %O",
      expectations.map((e) => e.expect.toString()),
    );

    console.log(`Running command: ${command}`);

    // Spawn the process with pipes for interaction
    const childProcess = execaCommand(command, {
      cwd: cwd ?? process.cwd(),
      stdio: "pipe",
      reject: false, // Never reject so we can handle the error ourselves
      env: process.env,
    });

    log("Process spawned with PID: %s", childProcess.pid);

    let stdout = "";
    let stderr = "";
    let buffer = "";
    let lastMatchIndex = 0; // Track the index where the last match occurred

    // Track patterns that have been matched
    const matchHistory = new Map<string | RegExp, number>();
    // Track current expectation index to process them in order
    let currentExpectationIndex = 0;

    // Initialize match count for each pattern
    expectations.forEach(({ expect: expectPattern }) => {
      matchHistory.set(expectPattern, 0);
      log("Initialized pattern match count for: %s", expectPattern.toString());
    });

    // Collect stdout
    childProcess.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      buffer += chunk;

      // Print to console
      process.stdout.write(chunk);

      // Only process expectations that haven't been fully matched yet
      // and in the order they were provided
      while (currentExpectationIndex < expectations.length) {
        const { expect: expectPattern, send } =
          expectations[currentExpectationIndex];
        const pattern =
          expectPattern instanceof RegExp
            ? expectPattern
            : new RegExp(expectPattern, "m");

        // Only search in the unmatched portion of the buffer
        const searchBuffer = buffer.substring(lastMatchIndex);

        log(
          "Testing pattern: %s against buffer from position %d (%d chars)",
          pattern.toString(),
          lastMatchIndex,
          searchBuffer.length,
        );

        // Enhanced debugging: show actual search buffer content
        log("Search buffer content for debugging: %O", searchBuffer);

        const match = searchBuffer.match(pattern);
        if (match) {
          // Found a match
          const patternStr = expectPattern.toString();
          const matchCount = matchHistory.get(expectPattern) || 0;

          // Update the lastMatchIndex to point after this match
          // Calculate the absolute position in the full buffer
          const matchStartPosition = lastMatchIndex + match.index!;
          const matchEndPosition = matchStartPosition + match[0].length;
          lastMatchIndex = matchEndPosition;

          log(
            `Pattern matched: "${patternStr}" (occurrence #${
              matchCount + 1
            }) at position ${matchStartPosition}-${matchEndPosition}`,
          );

          // Only send a response if one is specified
          if (send) {
            log(`Sending response: "${send.replace(/\r/g, "\\r")}" to stdin`);
            childProcess.stdin?.write(send);
          } else {
            log(`Pattern "${patternStr}" matched (verification only)`);
          }

          // Increment the match count for this pattern
          matchHistory.set(expectPattern, matchCount + 1);
          log("Updated match count for %s: %d", patternStr, matchCount + 1);

          // Move to the next expectation
          currentExpectationIndex++;
          // If we've processed all expectations but need to wait for stdin response,
          // delay closing stdin until the next data event
          if (currentExpectationIndex >= expectations.length && send) {
            log("All patterns matched, closing stdin after last response");
            childProcess.stdin?.end();
          }

          break; // Exit the while loop to process next chunk
        } else {
          log("Pattern not matched. Attempting to diagnose the mismatch:");

          // Try to find the closest substring that might partially match
          const patternString = pattern.toString();
          const patternCore = patternString.substring(
            1,
            patternString.lastIndexOf("/") > 0
              ? patternString.lastIndexOf("/")
              : patternString.length,
          );

          // Try partial matches to diagnose the issue
          for (let i = 3; i < patternCore.length; i++) {
            const partialPattern = patternCore.substring(0, i);
            const partialRegex = new RegExp(partialPattern, "m");
            const matches = partialRegex.test(searchBuffer);
            log(
              "  Partial pattern '%s': %s",
              partialPattern,
              matches ? "matched" : "not matched",
            );

            // Once we find where the matching starts to fail, stop
            if (!matches) break;
          }

          // Break the while loop as this pattern doesn't match yet
          break;
        }
      }

      // If all expectations have been matched, we can close stdin if not already closed
      if (
        currentExpectationIndex >= expectations.length &&
        childProcess.stdin?.writable
      ) {
        log("All patterns matched, ensuring stdin is closed");
        childProcess.stdin.end();
      }
    });

    // Collect stderr if needed
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        log("Received stderr chunk (%d bytes): %s", chunk.length, chunk.trim());
        // Also write stderr to console
        process.stderr.write(chunk);
      });
    }

    // Handle process completion
    childProcess.on("close", (code) => {
      log("Process closed with code: %s", code);

      // Log the number of matches for each pattern
      log("Pattern match summary:");
      for (const [pattern, count] of matchHistory.entries()) {
        log(`  - "${pattern.toString()}": ${count} matches`);
      }

      // Check if any required patterns were not matched
      const unmatchedPatterns = Array.from(matchHistory.entries())
        .filter(([_, count]) => count === 0)
        .map(([pattern, _]) => pattern.toString());

      if (unmatchedPatterns.length > 0) {
        log(
          "WARNING: Some expected patterns were not matched: %O",
          unmatchedPatterns,
        );
      }

      log(
        "$expect completed. Total stdout: %d bytes, stderr: %d bytes",
        stdout.length,
        stderr.length,
      );

      resolve({ stdout, stderr, code });
    });

    childProcess.on("error", (err) => {
      log("Process error: %O", err);
      if (options.reject) {
        reject(new Error(`Failed to execute command: ${err.message}`));
      } else {
        resolve({ stdout, stderr, code: null });
      }
    });
  });
}

/**
 * Ensures Cloudflare account ID is set in environment
 * First checks wrangler cache, then environment variables, and finally guides the user
 */
export async function ensureCloudflareAccountId(cwd?: string): Promise<void> {
  // Skip if already set
  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    log(
      "CLOUDFLARE_ACCOUNT_ID is already set: %s",
      process.env.CLOUDFLARE_ACCOUNT_ID,
    );
    console.log(
      `Using existing CLOUDFLARE_ACCOUNT_ID: ${process.env.CLOUDFLARE_ACCOUNT_ID}`,
    );
    return;
  }

  console.log("CLOUDFLARE_ACCOUNT_ID not set, checking wrangler cache...");

  try {
    // Check wrangler cache first - more reliable than parsing command output
    const workingDir = cwd || process.cwd();
    const accountCachePath = join(
      workingDir,
      "node_modules/.cache/wrangler/wrangler-account.json",
    );

    if (existsSync(accountCachePath)) {
      try {
        const accountCache = JSON.parse(readFileSync(accountCachePath, "utf8"));
        if (accountCache.account?.id) {
          const accountId = accountCache.account.id;
          process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
          log("Found CLOUDFLARE_ACCOUNT_ID in wrangler cache: %s", accountId);
          console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
          return;
        }
      } catch (parseError) {
        log("Failed to parse wrangler account cache: %O", parseError);
        // Continue to other methods if cache parsing fails
      }
    }

    // If we get here, we couldn't find the account ID in the cache
    // Give clear guidance to the user
    console.log("⚠️ Could not find Cloudflare account ID");
    console.log("Please either:");
    console.log(
      "  1. Run 'npx wrangler login' to authenticate with Cloudflare",
    );
    console.log(
      "  2. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables",
    );

    // Try wrangler whoami as a final attempt
    console.log("\nAttempting to get account info from wrangler...");
    const result = await $({
      cwd: workingDir,
      stdio: "pipe",
    })`npx wrangler whoami`;

    // If command succeeds, try to extract account ID from output
    if (result.stdout) {
      const accountIdMatch = result.stdout.match(/Account ID: ([a-f0-9]{32})/);
      if (accountIdMatch && accountIdMatch[1]) {
        const accountId = accountIdMatch[1];
        process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
        log("Extracted CLOUDFLARE_ACCOUNT_ID from whoami: %s", accountId);
        console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
        return;
      }
    }

    // If we get here, we've exhausted all options
    throw new Error(
      "Could not find Cloudflare account ID. Please login with 'npx wrangler login' or set CLOUDFLARE_ACCOUNT_ID manually.",
    );
  } catch (error) {
    log("Error during account ID detection: %O", error);
    throw error;
  }
}

/**
 * Run the release process and return the deployed URL and worker name
 */
export async function runRelease(
  cwd?: string,
): Promise<{ url: string; workerName: string }> {
  console.log("🚀 Running release process...");

  try {
    // Ensure CLOUDFLARE_ACCOUNT_ID is set before running release
    await ensureCloudflareAccountId(cwd);

    // Run release command with our interactive $expect utility
    log("Running release command with interactive prompts");
    const result = await $expect(
      "npm run release",
      [
        {
          // Make the pattern more flexible to account for potential whitespace differences
          expect: /Do you want to proceed with deployment\?\s*\(y\/N\)/i,
          send: "y\r",
        },
      ],
      cwd,
      { reject: false }, // Add reject: false to prevent uncaught promise rejections
    );

    // Check exit code to ensure command succeeded
    if (result.code !== 0) {
      // Add more contextual information about the error
      let errorMessage = `Release command failed with exit code ${result.code}`;

      // Add stderr output to the error message if available
      if (result.stderr && result.stderr.trim().length > 0) {
        // Extract the most relevant part of the error message
        const errorLines = result.stderr
          .split("\n")
          .filter(
            (line) =>
              line.includes("ERROR") ||
              line.includes("error:") ||
              line.includes("failed"),
          )
          .slice(0, 3) // Take just the first few error lines
          .join("\n");

        if (errorLines) {
          errorMessage += `\nError details: ${errorLines}`;
        }
      }

      log("ERROR: %s", errorMessage);
      throw new Error(errorMessage);
    }

    const stdout = result.stdout;

    // Extract deployment URL from output
    log("Extracting deployment URL from output");
    const urlMatch = stdout.match(
      /https:\/\/([a-zA-Z0-9-]+)\.redwoodjs\.workers\.dev/,
    );
    if (!urlMatch || !urlMatch[0]) {
      log("ERROR: Could not extract deployment URL from release output");

      // Log more details about the output for debugging
      log("Release command stdout: %s", stdout);
      if (result.stderr) {
        log("Release command stderr: %s", result.stderr);
      }

      throw new Error("Could not extract deployment URL from release output");
    }

    const url = urlMatch[0];
    const workerName = urlMatch[1];
    log("Successfully deployed to %s (worker: %s)", url, workerName);
    console.log(`✅ Successfully deployed to ${url}`);

    return { url, workerName };
  } catch (error) {
    log("ERROR: Failed to run release command: %O", error);
    throw error;
  }
}

/**
 * Runs tests against the production deployment
 */
export async function runReleaseTest(
  customPath: string = "/",
  artifactDir: string,
  resources?: Partial<TestResources>,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
): Promise<void> {
  log("Starting release test with path: %s", customPath || "/");
  console.log("\n🚀 Testing production deployment");

  try {
    log("Running release process");
    const { url, workerName } = await runRelease(resources?.targetDir);

    // Wait a moment before checking server availability
    log("Waiting 1s before checking server...");
    await setTimeout(1000);

    // DRY: check both root and custom path
    await checkServerUp(url, customPath);

    // Now run the tests with the custom path
    const testUrl =
      url +
      (customPath === "/"
        ? ""
        : customPath.startsWith("/")
          ? customPath
          : "/" + customPath);
    await checkUrl(
      testUrl,
      artifactDir,
      browserPath,
      headless,
      bail,
      skipClient,
      "Production", // Add environment context parameter
    );
    log("Release test completed successfully");

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
  } catch (error) {
    log("Error during release testing: %O", error);
    throw error;
  }
}

/**
 * Delete the worker using wrangler
 */
export async function deleteWorker(name: string, cwd?: string): Promise<void> {
  console.log(`Cleaning up: Deleting worker ${name}...`);
  try {
    // Use our $expect utility to handle any confirmation prompts
    log("Running wrangler delete command with interactive prompts");
    await $expect(
      `npx wrangler delete ${name}`,
      [
        {
          expect: "Are you sure you want to delete",
          send: "y\r",
        },
      ],
      cwd,
    );
    console.log(`✅ Worker ${name} deleted successfully`);
  } catch (error) {
    console.error(`Failed to delete worker ${name}: ${error}`);
    // Retry with force flag if the first attempt failed
    try {
      console.log("Retrying with force flag...");
      await $expect(
        `npx wrangler delete ${name} --yes --force`,
        [
          {
            expect: "Are you sure you want to delete",
            send: "y\r",
          },
        ],
        cwd,
      );
      console.log(`✅ Worker ${name} force deleted successfully`);
    } catch (retryError) {
      console.error(`Failed to force delete worker ${name}: ${retryError}`);
    }
  }
}
