import { join, basename } from "path";
import { setTimeout } from "node:timers/promises";
import { log } from "./constants.mjs";
import { checkUrl, checkServerUp } from "./browser.mjs";
import { TestResources } from "./types.mjs";
import { $ } from "../../lib/$.mjs";
import { execaCommand } from "execa";
import { existsSync, readFileSync } from "fs";
import { pathExists } from "fs-extra";
import { parse as parseJsonc } from "jsonc-parser";
import * as fs from "fs/promises";
import { extractLastJson, parseJson } from "../../lib/jsonUtils.mjs";

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

// Define interfaces for API responses
interface Worker {
  name?: string;
  id?: string;
  [key: string]: any;
}

interface D1Database {
  name: string;
  uuid: string;
  [key: string]: any;
}

/**
 * A mini expect-like utility for handling interactive CLI prompts and verifying output
 * @param command The command to execute
 * @param expectations Array of {expect, send} objects for interactive responses and verification
 * @param options Additional options for command execution including working directory and environment
 * @returns Promise that resolves when the command completes
 */
export async function $expect(
  command: string,
  expectations: Array<ExpectOptions>,
  options: { reject?: boolean; env?: NodeJS.ProcessEnv; cwd?: string } = {
    reject: true,
  },
): Promise<ExpectResult> {
  return new Promise((resolve, reject) => {
    log("$expect starting with command: %s", command);
    log("Working directory: %s", options.cwd ?? process.cwd());
    log(
      "Expected patterns: %O",
      expectations.map((e) => e.expect.toString()),
    );

    console.log(`Running command: ${command}`);

    // Spawn the process with pipes for interaction
    const childProcess = execaCommand(command, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "pipe",
      reject: false, // Never reject so we can handle the error ourselves
      env: options.env ?? process.env,
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
export async function ensureCloudflareAccountId(
  cwd?: string,
  projectDir?: string,
): Promise<void> {
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
    // Check wrangler cache in the project directory, not the current working directory
    projectDir = projectDir || cwd || process.cwd();
    log("Looking for wrangler cache in project directory: %s", projectDir);
    const accountCachePath = join(
      projectDir,
      "node_modules/.cache/wrangler/wrangler-account.json",
    );

    if (existsSync(accountCachePath)) {
      try {
        const accountCache = JSON.parse(readFileSync(accountCachePath, "utf8"));
        if (accountCache.account?.id) {
          const accountId = accountCache.account.id;
          process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
          log("Found CLOUDFLARE_ACCOUNT_ID in wrangler cache: %s", accountId);
          console.log(
            `✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId} (from wrangler cache)`,
          );
          return;
        }
      } catch (parseError) {
        log("Failed to parse wrangler account cache: %O", parseError);
        // Continue to other methods if cache parsing fails
      }
    } else {
      log("Wrangler account cache not found at: %s", accountCachePath);
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
      cwd: projectDir,
      stdio: "pipe",
    })`npx wrangler whoami`;

    // First try regex pattern matching on the text output
    if (result.stdout) {
      const accountIdMatch = result.stdout.match(/Account ID: ([a-f0-9]{32})/);
      if (accountIdMatch && accountIdMatch[1]) {
        const accountId = accountIdMatch[1];
        process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
        log("Extracted CLOUDFLARE_ACCOUNT_ID from whoami text: %s", accountId);
        console.log(
          `✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId} (from wrangler whoami)`,
        );
        return;
      }
    }

    // Fallback: try to extract any JSON that might be in the output
    const accountInfo = extractLastJson(result.stdout);
    if (accountInfo && accountInfo.account && accountInfo.account.id) {
      const accountId = accountInfo.account.id;
      process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
      log("Extracted CLOUDFLARE_ACCOUNT_ID from whoami JSON: %s", accountId);
      console.log(
        `✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId} (from wrangler whoami)`,
      );
      return;
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
 * Run the release command to deploy to Cloudflare
 */
export async function runRelease(
  cwd: string,
  projectDir: string,
  resourceUniqueKey: string,
): Promise<{ url: string; workerName: string }> {
  log("Running release command");
  console.log("\n🚀 Deploying worker to Cloudflare...");

  try {
    // Make sure we have an account ID
    await ensureCloudflareAccountId(cwd, projectDir);

    // Extract worker name from directory name to ensure consistency
    const dirName = cwd ? basename(cwd) : "unknown-worker";

    // Ensure resource unique key is included in worker name for tracking
    if (resourceUniqueKey && !dirName.includes(resourceUniqueKey)) {
      log(
        `Worker name doesn't contain our unique key, this is unexpected: ${dirName}, key: ${resourceUniqueKey}`,
      );
      console.log(
        `⚠️ Worker name doesn't contain our unique key. This might cause cleanup issues.`,
      );
    }

    // Ensure the worker name in wrangler.jsonc matches our unique name
    if (cwd) {
      try {
        const wranglerPath = join(cwd, "wrangler.jsonc");
        if (await pathExists(wranglerPath)) {
          log(
            "Updating wrangler.jsonc to use our unique worker name: %s",
            dirName,
          );

          // Read the wrangler config - handle both jsonc and json formats
          const wranglerContent = await fs.readFile(wranglerPath, "utf-8");

          // Use parseJsonc which handles comments and is more tolerant
          let wranglerConfig;
          try {
            wranglerConfig = parseJsonc(wranglerContent);
          } catch (parseError) {
            // Fallback to standard JSON if jsonc parsing fails
            log("JSONC parsing failed, trying standard JSON: %O", parseError);
            wranglerConfig = JSON.parse(wranglerContent);
          }

          // Update the name
          if (wranglerConfig.name !== dirName) {
            wranglerConfig.name = dirName;
            await fs.writeFile(
              wranglerPath,
              JSON.stringify(wranglerConfig, null, 2),
            );
            log("Updated wrangler.jsonc with unique worker name: %s", dirName);
          }
        }
      } catch (error) {
        log("Error updating wrangler.jsonc: %O", error);
        console.error(`Warning: Could not update wrangler.jsonc: ${error}`);
      }
    }

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
      {
        reject: false, // Add reject: false to prevent uncaught promise rejections
        env: {
          RWSDK_RENAME_WORKER: "1",
          RWSDK_RENAME_DB: "1",
          ...process.env,
        },
        cwd,
      },
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
  resources: TestResources,
  browserPath?: string,
  headless: boolean = true,
  bail: boolean = false,
  skipClient: boolean = false,
  projectDir?: string,
  realtime: boolean = false,
  skipHmr: boolean = false,
): Promise<void> {
  log("Starting release test with path: %s", customPath || "/");
  console.log("\n🚀 Testing production deployment");

  try {
    log("Running release process");
    const { url, workerName } = await runRelease(
      resources.targetDir || "",
      projectDir || "",
      resources.resourceUniqueKey,
    );

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
      "Production",
      realtime,
      resources.targetDir, // Add target directory parameter
      true, // Always skip HMR in production
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
 * Check if a resource name includes a specific resource unique key
 * This is used to identify resources created during our tests
 */
export function isRelatedToTest(
  resourceName: string,
  resourceUniqueKey: string,
): boolean {
  return resourceName.includes(resourceUniqueKey);
}

/**
 * Delete the worker using wrangler
 */
export async function deleteWorker(
  name: string,
  cwd: string,
  resourceUniqueKey: string,
): Promise<void> {
  console.log(`Cleaning up: Deleting worker ${name}...`);

  // Safety check: if we have a resourceUniqueKey, verify this worker name contains it
  if (resourceUniqueKey && !isRelatedToTest(name, resourceUniqueKey)) {
    log(
      `Worker ${name} does not contain unique key ${resourceUniqueKey}, not deleting for safety`,
    );
    console.log(
      `⚠️ Worker ${name} does not seem to be created by this test, skipping deletion for safety`,
    );
    return;
  }

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
      {
        cwd,
      },
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
        {
          cwd,
        },
      );
      console.log(`✅ Worker ${name} force deleted successfully`);
    } catch (retryError) {
      console.error(`Failed to force delete worker ${name}: ${retryError}`);
    }
  }
}

/**
 * List D1 databases using wrangler
 */
export async function listD1Databases(
  cwd?: string,
): Promise<Array<D1Database>> {
  log("Listing D1 databases");
  try {
    const result = await $({
      cwd,
      stdio: "pipe",
    })`npx wrangler d1 list --json`;

    // Parse the JSON output to extract the last valid JSON
    const data = parseJson<D1Database[] | { databases?: D1Database[] }>(
      result.stdout,
      [],
    );

    if (Array.isArray(data)) {
      log("Found %d D1 databases in parsed array", data.length);
      return data;
    } else if (data.databases && Array.isArray(data.databases)) {
      log(
        "Found %d D1 databases in 'databases' property",
        data.databases.length,
      );
      return data.databases;
    }

    // If nothing worked, return an empty array
    log("Could not parse JSON from output, returning empty array");
    return [];
  } catch (error) {
    log("Error listing D1 databases: %O", error);
    console.error(`Failed to list D1 databases: ${error}`);
    return [];
  }
}

/**
 * Delete a D1 database using wrangler
 */
export async function deleteD1Database(
  name: string,
  cwd: string,
  resourceUniqueKey: string,
): Promise<void> {
  console.log(`Cleaning up: Deleting D1 database ${name}...`);
  try {
    // First check if the database exists
    const databases = await listD1Databases(cwd);
    const exists = databases.some((db) => db.name === name);

    if (!exists) {
      log(`D1 database ${name} not found, skipping deletion`);
      console.log(`⚠️ D1 database ${name} not found, skipping deletion`);
      return;
    }

    // Extra safety check: if we have a resourceUniqueKey, verify this database is related to our test
    if (resourceUniqueKey && !isRelatedToTest(name, resourceUniqueKey)) {
      log(
        `D1 database ${name} does not contain unique key ${resourceUniqueKey}, not deleting for safety`,
      );
      console.log(
        `⚠️ D1 database ${name} does not seem to be created by this test, skipping deletion for safety`,
      );
      return;
    }

    // Use our $expect utility to handle any confirmation prompts
    log("Running wrangler d1 delete command with interactive prompts");
    await $expect(
      `npx wrangler d1 delete ${name}`,
      [
        {
          expect: "Are you sure you want to delete",
          send: "y\r",
        },
      ],
      {
        cwd,
      },
    );
    console.log(`✅ D1 database ${name} deleted successfully`);
  } catch (error) {
    console.error(`Failed to delete D1 database ${name}: ${error}`);
    // Retry with force flag if the first attempt failed
    try {
      console.log("Retrying with force flag...");
      await $expect(
        `npx wrangler d1 delete ${name} --yes --force`,
        [
          {
            expect: "Are you sure you want to delete",
            send: "y\r",
          },
        ],
        {
          cwd,
        },
      );
      console.log(`✅ D1 database ${name} force deleted successfully`);
    } catch (retryError) {
      console.error(
        `Failed to force delete D1 database ${name}: ${retryError}`,
      );
    }
  }
}
