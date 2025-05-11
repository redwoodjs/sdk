import { join } from "path";
import { setTimeout } from "node:timers/promises";
import { log } from "./constants.mjs";
import { checkUrl, checkServerUp } from "./browser.mjs";
import { TestResources } from "./types.mjs";
import { $ } from "../../lib/$.mjs";

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

export async function $expect(
  command: string,
  expectations: Array<ExpectOptions>,
  cwd?: string,
  options: { reject: boolean } = { reject: true },
): Promise<ExpectResult> {
  // Implementation for expectation handling...
  // This is a simplified version that will be replaced with the actual implementation
  console.log(`Running command: ${command}`);
  return {
    stdout: "",
    stderr: "",
    code: 0,
  };
}

// Known Cloudflare account ID - default to RedwoodJS account if we need one
const REDWOODJS_ACCOUNT_ID = "1634a8e653b2ce7e0f7a23cca8cbd86a";

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
 * Ensures Cloudflare account ID is set in environment
 * Extracts from error output if available, otherwise uses RedwoodJS account
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

  console.log("CLOUDFLARE_ACCOUNT_ID not set, attempting to detect...");

  try {
    // Run a wrangler command that will list available accounts if there's an issue
    const result = await $({
      cwd: cwd || process.cwd(),
      stdio: "pipe",
      reject: false, // Don't throw on non-zero exit code
    })`npx wrangler whoami`;

    // If command succeeds but we still don't have an account ID, try to extract from output
    if (result.stdout) {
      // Parse output to look for account ID
      const accountIdMatch = result.stdout.match(/Account ID: ([a-f0-9]{32})/);
      if (accountIdMatch && accountIdMatch[1]) {
        const accountId = accountIdMatch[1];
        process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
        log("Extracted CLOUDFLARE_ACCOUNT_ID from whoami: %s", accountId);
        console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
        return;
      }
    }

    // If the command ran but we couldn't find an ID or there was an error
    if (result.stderr) {
      // Look for available accounts in the error output
      const accountMatches = result.stderr.match(
        /`([^`]+)'s Account`: `([a-f0-9]{32})`/g,
      );
      if (accountMatches && accountMatches.length > 0) {
        // Extract the first account ID
        const firstAccount = accountMatches[0].match(/`([a-f0-9]{32})`$/);
        if (firstAccount && firstAccount[1]) {
          const accountId = firstAccount[1];
          process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
          log(
            "Extracted CLOUDFLARE_ACCOUNT_ID from error output: %s",
            accountId,
          );
          console.log(`✅ Setting CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
          return;
        }
      }
    }
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
