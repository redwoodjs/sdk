import debug from "debug";
import { execaCommand } from "execa";
import { existsSync, readFileSync } from "fs";
import { pathExists } from "fs-extra";
import * as fs from "fs/promises";
import { parse as parseJsonc } from "jsonc-parser";
import { setTimeout } from "node:timers/promises";
import { basename, dirname, join, resolve } from "path";
import { $ } from "../../lib/$.mjs";
import { extractLastJson, parseJson } from "../../lib/jsonUtils.mjs";
import { IS_DEBUG_MODE } from "./constants.mjs";

const log = debug("rwsdk:e2e:release");

/**
 * Find wrangler cache by searching up the directory tree for node_modules/.cache/wrangler
 */
function findWranglerCache(startDir: string): string | null {
  let currentDir = resolve(startDir);
  const root = resolve("/");

  while (currentDir !== root) {
    const cacheDir = join(currentDir, "node_modules/.cache/wrangler");
    const accountCachePath = join(cacheDir, "wrangler-account.json");

    if (existsSync(accountCachePath)) {
      log("Found wrangler cache at: %s", accountCachePath);
      return accountCachePath;
    }

    // Move up one directory
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  log("No wrangler cache found in directory tree starting from: %s", startDir);
  return null;
}

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
    // Spawn the process with pipes for interaction
    const childProcess = execaCommand(command, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "pipe",
      reject: false, // Never reject so we can handle the error ourselves
      env: options.env ?? process.env,
    });

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
    });

    // Collect stdout
    childProcess.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      buffer += chunk;

      // Print to console in debug mode
      if (IS_DEBUG_MODE) {
        process.stdout.write(chunk);
      }

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

          if (send) {
            childProcess.stdin?.write(send);
          }

          // Increment the match count for this pattern
          matchHistory.set(expectPattern, matchCount + 1);

          // Move to the next expectation
          currentExpectationIndex++;
          // If we've processed all expectations but need to wait for stdin response,
          // delay closing stdin until the next data event
          if (currentExpectationIndex >= expectations.length && send) {
            childProcess.stdin?.end();
          }

          break; // Exit the while loop to process next chunk
        } else {
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
        childProcess.stdin.end();
      }
    });

    // Collect stderr if needed
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        // Also write stderr to console in debug mode
        if (IS_DEBUG_MODE) {
          process.stderr.write(chunk);
        }
      });
    }

    // Handle process completion
    childProcess.on("close", (code) => {
      log("Process closed with code: %s", code);
      // Check if any required patterns were not matched
      const unmatchedPatterns = Array.from(matchHistory.entries())
        .filter(([_, count]) => count === 0)
        .map(([pattern, _]) => pattern.toString());

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
    // Search up the directory tree for wrangler cache (supports monorepo setups)
    projectDir = projectDir || cwd || process.cwd();
    log("Looking for wrangler cache starting from: %s", projectDir);

    const accountCachePath = findWranglerCache(projectDir);

    if (accountCachePath) {
      try {
        const accountCache = JSON.parse(readFileSync(accountCachePath, "utf8"));
        if (accountCache.account?.id) {
          const accountId = accountCache.account.id;
          process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
          log("Found CLOUDFLARE_ACCOUNT_ID in wrangler cache: %s", accountId);
          console.log(
            `✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId} (from wrangler cache)`,
          );
          console.log(`   Cache location: ${accountCachePath}`);
          return;
        }
      } catch (parseError) {
        log("Failed to parse wrangler account cache: %O", parseError);
        // Continue to other methods if cache parsing fails
      }
    } else {
      console.log(
        `⚠️ No wrangler account cache found in directory tree starting from: ${projectDir}`,
      );
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

    // Extract hash part from resourceUniqueKey for matching
    // resourceUniqueKey format is typically "adjective-animal-hash" or just "hash"
    const hashPart = resourceUniqueKey.includes("-")
      ? resourceUniqueKey.split("-").pop() || resourceUniqueKey.substring(0, 8)
      : resourceUniqueKey.substring(0, 8);
    const uniqueKeyForMatching = hashPart.substring(0, 8);

    // Ensure resource unique key is included in worker name for tracking
    if (resourceUniqueKey && !dirName.includes(uniqueKeyForMatching)) {
      log(
        `Worker name doesn't contain our unique key, this is unexpected: ${dirName}, key: ${uniqueKeyForMatching}`,
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

    // Run release command with our interactive $expect utility and retry logic
    log("Running release command with interactive prompts and retries");

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    let result: ExpectResult | null = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        console.log(
          `\n🚀 Deploying worker to Cloudflare (Attempt ${i + 1}/${MAX_RETRIES})...`,
        );
        result = await $expect(
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
              NODE_ENV: "production",
              RWSDK_RENAME_WORKER: "1",
              RWSDK_RENAME_DB: "1",
              ...process.env,
            },
            cwd,
          },
        );

        // Check exit code to ensure command succeeded
        if (result.code === 0) {
          log(`Release command succeeded on attempt ${i + 1}`);
          lastError = null; // Clear last error on success
          break; // Exit the loop on success
        } else {
          throw new Error(
            `Release command failed with exit code ${result.code}`,
          );
        }
      } catch (error) {
        lastError = error as Error;
        log(`Attempt ${i + 1} failed: ${lastError.message}`);
        if (i < MAX_RETRIES - 1) {
          console.log(`   Waiting 5 seconds before retrying...`);
          await setTimeout(5000);
        }
      }
    }

    if (lastError || !result) {
      log("ERROR: Release command failed after all retries.");
      throw lastError || new Error("Release command failed after all retries.");
    }

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
 * Check if a resource name includes a specific resource unique key
 * This is used to identify resources created during our tests
 * Handles both full format (adjective-animal-hash) and hash-only format
 */
export function isRelatedToTest(
  resourceName: string,
  resourceUniqueKey: string,
): boolean {
  // Extract hash part if resourceUniqueKey contains dashes (full format)
  // Otherwise use as-is (hash-only format)
  const hashPart = resourceUniqueKey.includes("-")
    ? resourceUniqueKey.split("-").pop() || resourceUniqueKey.substring(0, 8)
    : resourceUniqueKey;
  const uniqueKeyForMatching = hashPart.substring(0, 8);
  return resourceName.includes(uniqueKeyForMatching);
}

/**
 * Delete the worker using wrangler
 */
export async function deleteWorker(
  workerName: string,
  projectDir: string,
  resourceUniqueKey: string,
) {
  console.log(`Cleaning up: Deleting worker ${workerName}...`);

  // We are extra careful here to not delete workers that are not related to
  // the current test run. We check if the worker name contains the resource
  // unique key, and if the project directory also contains the resource unique
  // key.
  if (!isRelatedToTest(workerName, resourceUniqueKey)) {
    console.warn(
      `⚠️ Worker name "${workerName}" does not contain resource unique key "${resourceUniqueKey}". Skipping delete.`,
    );
    return;
  }
  if (!isRelatedToTest(projectDir, resourceUniqueKey)) {
    console.warn(
      `⚠️ Project dir "${projectDir}" does not contain resource unique key "${resourceUniqueKey}". Skipping delete.`,
    );
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error(
      "❌ CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars must be set to delete worker",
    );
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`;
  console.log(`Running API call: DELETE ${url}`);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cloudflare API request failed with status ${response.status}: ${errorText}`,
      );
    }

    const responseData = (await response.json()) as {
      success: boolean;
      errors: unknown[];
    };

    if (!responseData.success) {
      throw new Error(
        `Cloudflare API returned an error: ${JSON.stringify(responseData.errors)}`,
      );
    }

    console.log(`✅ Successfully deleted worker "${workerName}"`);
  } catch (error) {
    console.error(`❌ Failed to delete worker "${workerName}"`);
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`);
    } else {
      console.error("An unknown error occurred:", error);
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
  // Check wrangler.jsonc to see if a database is configured
  const wranglerConfigPath = resolve(cwd, "wrangler.jsonc");
  try {
    const configContent = await fs.readFile(wranglerConfigPath, "utf-8");
    const config = parseJsonc(configContent);
    if (!config.d1_databases || config.d1_databases.length === 0) {
      log("No D1 databases configured in wrangler.jsonc, skipping deletion.");
      return;
    }
  } catch (error) {
    log(
      `Could not read or parse wrangler.jsonc at ${wranglerConfigPath}, proceeding with deletion attempt anyway.`,
      error,
    );
  }

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
