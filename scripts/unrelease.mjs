#!/usr/bin/env node

import { execSync } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function exec(command, options = {}) {
  console.log(`Running: ${command}`);
  if (options.dryRun) {
    console.log(`  [DRY RUN] Would execute: ${command}`);
    return { stdout: "", stderr: "" };
  }
  return execSync(command, {
    ...options,
    encoding: "utf-8",
  });
}

function question(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function promptConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await question(
      rl,
      `${message} (type 'Y' and press Enter to confirm): `,
    );
    return answer.trim().toUpperCase() === "Y";
  } finally {
    rl.close();
  }
}

function getLatestStableRelease(tagToExclude) {
  try {
    const output = execSync(
      `gh release list --limit 100 --json tagName,isPrerelease,publishedAt`,
      { encoding: "utf-8", stdio: "pipe" },
    );
    const releases = JSON.parse(output);
    const latestStable = releases
      .filter((r) => !r.isPrerelease && r.tagName !== tagToExclude)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0];
    return latestStable?.tagName || null;
  } catch (error) {
    console.error(`Failed to get latest stable release: ${error.message}`);
    return null;
  }
}

function isLatestRelease(tagName) {
  try {
    const output = execSync(`gh release view "${tagName}" --json isLatest`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const release = JSON.parse(output);
    return release.isLatest === true;
  } catch (error) {
    if (error.message.includes("not found")) {
      return false;
    }
    console.error(`Failed to check if release is latest: ${error.message}`);
    return false;
  }
}

function deprecateOnNpm(version, reason, dryRun) {
  const command = `npm deprecate rwsdk@"${version}" "${reason}"`;
  exec(command, { cwd: path.join(rootDir, "sdk"), dryRun });
}

function deleteGitHubRelease(tagName, dryRun) {
  exec(`gh release delete "${tagName}" --yes`, { dryRun });
}

function deleteGitTag(tagName, dryRun) {
  exec(`git push --delete origin "${tagName}"`, { dryRun });
}

function markAsLatest(tagName, dryRun) {
  exec(`gh release edit "${tagName}" --latest`, { dryRun });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  let version;
  let reason = "This version has been unpublished due to a critical issue.";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--version" && args[i + 1]) {
      version = args[i + 1];
      i++;
    } else if (args[i] === "--reason" && args[i + 1]) {
      reason = args[i + 1];
      i++;
    }
  }

  if (!version) {
    console.error("Error: --version is required");
    console.error(
      "Usage: pnpm unrelease --version <version> [--reason <reason>] [--dry-run]",
    );
    process.exit(1);
  }

  const tagName = `v${version}`;

  console.log(`\nUnreleasing version: ${version}`);
  console.log(`Tag name: ${tagName}`);
  console.log(`Deprecation reason: ${reason}`);
  if (dryRun) {
    console.log(`Mode: DRY RUN (no changes will be made)`);
  }

  if (!dryRun) {
    const confirmed = await promptConfirmation(
      `\n⚠️  This will deprecate the npm package, delete the GitHub release, and remove the git tag.\nAre you sure you want to proceed?`,
    );

    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\n📦 Deprecating package on npm...");
  deprecateOnNpm(version, reason, dryRun);

  console.log("\n🔍 Checking if release is marked as latest...");
  const isLatest = isLatestRelease(tagName);

  if (isLatest) {
    console.log(
      `Release ${tagName} is marked as latest. Finding the next latest release...`,
    );
    const newLatestTag = getLatestStableRelease(tagName);

    if (newLatestTag && newLatestTag !== "null") {
      console.log(`Marking ${newLatestTag} as the new latest release.`);
      markAsLatest(newLatestTag, dryRun);
    } else {
      console.log("No other stable release found to mark as latest.");
    }
  }

  console.log("\n🗑️  Deleting GitHub release...");
  let releaseExists = false;
  try {
    if (dryRun) {
      console.log(`  [DRY RUN] Checking if release ${tagName} exists...`);
      try {
        execSync(`gh release view "${tagName}"`, { stdio: "ignore" });
        releaseExists = true;
      } catch {
        releaseExists = false;
      }
    } else {
      execSync(`gh release view "${tagName}"`, { stdio: "ignore" });
      releaseExists = true;
    }
  } catch (error) {
    releaseExists = false;
  }

  if (releaseExists) {
    deleteGitHubRelease(tagName, dryRun);
  } else {
    console.log(
      `No GitHub release found for tag ${tagName}. Skipping deletion.`,
    );
  }

  console.log("\n🏷️  Deleting git tag...");
  deleteGitTag(tagName, dryRun);

  console.log("\n✅ Unrelease complete!");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
