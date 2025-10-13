#!/usr/bin/env -S npx tsx

import { execSync } from "child_process";

const fiveMinutes = 5 * 60 * 1000;
const tenSeconds = 10 * 1000;
const pollInterval = tenSeconds;
const timeout = fiveMinutes;

async function main() {
  console.log("Looking for GitHub CLI 'gh'...");
  try {
    execSync("gh --version", { stdio: "pipe" });
  } catch (error) {
    console.error("'gh' command could not be found.");
    console.error("Please install the GitHub CLI: https://cli.github.com/");
    process.exit(1);
  }

  console.log("Authenticating with GitHub...");
  try {
    execSync("gh auth status", { stdio: "inherit" });
  } catch (error) {
    console.error("Please authenticate with 'gh auth login'.");
    process.exit(1);
  }

  const branch = execSync("git branch --show-current").toString().trim();
  if (!branch) {
    console.error("Could not determine the current git branch.");
    process.exit(1);
  }
  console.log(`Current branch is '${branch}'.`);

  console.log(
    `Triggering the 'Windows Debug Session' workflow on branch '${branch}'...`,
  );
  execSync(`gh workflow run windows-debug.yml --ref "${branch}"`);

  console.log("Waiting a moment for the workflow run to be created...");
  await sleep(5000);

  let runId = "";
  // Retry finding the run ID a few times in case of replication lag
  for (let i = 0; i < 5; i++) {
    try {
      const result = execSync(
        `gh run list --workflow="windows-debug.yml" --branch="${branch}" --limit 1 --json databaseId -q '.[0].databaseId'`,
      ).toString();
      runId = result.trim();
      if (runId) break;
    } catch (e) {
      // ignore and retry
    }
    await sleep(2000);
  }

  if (!runId) {
    console.error(
      "Could not find a recent workflow run. Please check the Actions tab in your repository.",
    );
    process.exit(1);
  }

  const runUrl = execSync(`gh run view ${runId} --json url -q .url`)
    .toString()
    .trim();
  console.log(`Successfully triggered workflow. Run ID: ${runId}`);
  console.log(`You can view the run at: ${runUrl}`);
  console.log("Waiting for tmate SSH connection string in logs...");

  const startTime = Date.now();
  let sshConnectionString = "";

  while (Date.now() - startTime < timeout) {
    try {
      // This command fetches the entire log for a run. It may fail if the
      // run is just starting, so we retry.
      const log = execSync(`gh run view ${runId} --log`).toString();

      // tmate outputs a few different lines. We look for the simplest one.
      const match = log.match(/ssh\s+[a-zA-Z0-9\S]+@[\w\.]+\.tmate\.io/);
      if (match && match[0]) {
        sshConnectionString = match[0];
        break;
      }
    } catch (error) {
      // The command might fail if the run hasn't started logging yet.
      // We'll just ignore and retry.
    }
    console.log("Still waiting for SSH connection string...");
    await sleep(pollInterval);
  }

  if (sshConnectionString) {
    console.log("\n=======================================================");
    console.log("         Windows Debug Session Ready");
    console.log("=======================================================");
    console.log("\nPaste this command into your terminal to connect:");
    console.log(`\n  ${sshConnectionString}\n`);
    console.log("=======================================================\n");
  } else {
    console.error(
      "\nThe workflow timed out without providing an SSH connection string.",
    );
    console.error(`Please check the logs for errors: ${runUrl}`);
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
