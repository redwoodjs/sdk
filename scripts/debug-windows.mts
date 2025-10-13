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

  const repoName = execSync(
    "gh repo view --json nameWithOwner -q .nameWithOwner",
  )
    .toString()
    .trim();
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
  for (let i = 0; i < 5; i++) {
    try {
      const result = execSync(
        `gh run list --workflow="windows-debug.yml" --branch="${branch}" --limit 1 --json databaseId`,
      ).toString();
      runId = JSON.parse(result)[0]?.databaseId;
      if (runId) break;
    } catch (e) {
      // ignore
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
  console.log("Waiting for SSH connection details artifact...");

  const startTime = Date.now();
  let connectionDetails: { [key: string]: string } = {};

  while (Date.now() - startTime < timeout) {
    try {
      const artifactsJson = execSync(
        `gh api repos/${repoName}/actions/runs/${runId}/artifacts -q '.artifacts | map(select(.name == "ssh-connection-details")) | .[0]'`,
      ).toString();

      if (artifactsJson && artifactsJson.trim()) {
        const artifact = JSON.parse(artifactsJson);
        if (artifact && artifact.id) {
          console.log("Found artifact. Downloading...");
          const artifactDir = "ssh-artifact";
          execSync(`rm -rf ${artifactDir} && mkdir ${artifactDir}`);
          execSync(
            `gh run download ${runId} -n ssh-connection-details -D ${artifactDir}`,
          );

          const connectionJson = execSync(
            `cat ${artifactDir}/connection.json`,
          ).toString();
          connectionDetails = JSON.parse(connectionJson);
          execSync(`rm -rf ${artifactDir}`);
          break;
        }
      }
    } catch (error) {
      // Ignore and retry
    }
    console.log(`Still waiting for artifact...`);
    await sleep(pollInterval);
  }

  if (Object.keys(connectionDetails).length === 4) {
    displayConnectionInstructions(connectionDetails);
  } else {
    console.error(
      "\nThe workflow timed out without providing SSH connection details.",
    );
    console.error(`Please check the logs for errors: ${runUrl}`);
    process.exit(1);
  }
}

function displayConnectionInstructions(details: { [key: string]: string }) {
  const { Host, Port, User, Password } = details;
  const sshTarget = `${User}@${Host}`;

  console.log("\n=======================================================");
  console.log("         Windows Debug Session Ready");
  console.log("=======================================================");
  console.log("\nUse the following details to connect with VS Code:");
  console.log("\n-------------------------------------------------------");
  console.log("  Connect with VS Code Remote - SSH");
  console.log("-------------------------------------------------------");
  console.log(
    '1. Open the Command Palette (Cmd+Shift+P) and run "Remote-SSH: Connect to Host..."',
  );
  console.log(`2. Select "+ Add New SSH Host..."`);
  console.log(
    `3. Enter the following command when prompted: ssh -p ${Port} ${sshTarget}`,
  );
  console.log(`4. When prompted for the password, use: ${Password}`);
  console.log(
    '5. Once connected, use "File > Open Folder..." and enter the path: D:\\a\\sdk\\sdk',
  );
  console.log("=======================================================\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
