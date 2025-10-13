#!/usr/bin/env -S npx tsx

import { execSync, spawn } from "child_process";

const thirtySeconds = 30 * 1000;
const fiveMinutes = 5 * 60 * 1000;
const tenSeconds = 10 * 1000;
const pollInterval = tenSeconds;
const timeout = fiveMinutes;
const initialWait = thirtySeconds;

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
  console.log("Waiting for the tmate SSH session to become available...");
  console.log("This may take a few minutes while the runner is being set up.");

  await sleep(initialWait);

  const startTime = Date.now();
  let sshCommand = "";

  while (Date.now() - startTime < timeout) {
    try {
      const artifactsJson = execSync(
        `gh api repos/${repoName}/actions/runs/${runId}/artifacts -q '.artifacts | map(select(.name == "tmate-connection")) | .[0]'`,
      ).toString();

      if (artifactsJson && artifactsJson.trim()) {
        const artifact = JSON.parse(artifactsJson);
        if (artifact && artifact.id) {
          console.log("Found tmate connection artifact. Downloading...");
          // Create a temporary directory for the artifact
          const artifactDir = "tmate-artifact";
          execSync(`rm -rf ${artifactDir} && mkdir ${artifactDir}`);
          execSync(
            `gh run download ${runId} -n tmate-connection -D ${artifactDir}`,
          );

          // The action saves the file as 'tmate.sh' inside the artifact
          const sshScriptContent = execSync(
            `cat ${artifactDir}/tmate.sh`,
          ).toString();
          const match = sshScriptContent.match(/ssh .*@.*\.tmate\.io/);
          if (match && match[0]) {
            sshCommand = match[0];
            execSync(`rm -rf ${artifactDir}`);
            break;
          }
        }
      }

      const statusResult = execSync(
        `gh run view ${runId} --json status -q .status`,
      )
        .toString()
        .trim();
      if (statusResult === "completed") {
        console.error(
          "The workflow run completed without providing an SSH connection.",
        );
        console.error(`Please check the logs for errors: ${runUrl}`);
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          "Error checking for artifact, will retry:",
          error.message,
        );
      } else {
        console.error(
          "An unknown error occurred while checking for artifact, will retry",
        );
      }
    }
    console.log(`Still waiting for session artifact...`);
    await sleep(pollInterval);
  }

  if (!sshCommand) {
    console.error(
      "The workflow timed out without providing an SSH connection string.",
    );
    console.error("Please check the workflow logs for errors.");
    process.exit(1);
  }

  console.log("");
  console.log("==========================================");
  console.log("          SSH Session Ready");
  console.log("==========================================");
  console.log("Connecting to the remote session now...");
  console.log("The session will remain active for up to 60 minutes.");
  console.log("==========================================");
  console.log("");

  const [command, ...args] = sshCommand.split(" ");
  const sshProcess = spawn(command, args, { stdio: "inherit" });

  sshProcess.on("error", (err) => {
    console.error("Failed to start SSH session:", err);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("An unexpected error occurred:", error);
  process.exit(1);
});
