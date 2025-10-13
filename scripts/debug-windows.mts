#!/usr/bin/env -S npx tsx

import { execSync } from "child_process";

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

  console.log("\n=======================================================");
  console.log("         Windows Debug Session Initialized");
  console.log("=======================================================");
  console.log(`\nWorkflow run URL: ${runUrl}\n`);
  console.log(
    "Open the URL above and wait for the 'Setup tmate session' step.",
  );
  console.log("You will find the SSH connection string in the logs.");
  console.log("\n-------------------------------------------------------");
  console.log("  Optional: Mount remote filesystem with SSHFS");
  console.log("-------------------------------------------------------");
  console.log(
    "1. Install sshfs (e.g., `brew install sshfs` on macOS, `sudo apt-get install sshfs` on Debian/Ubuntu).",
  );
  console.log("2. Create a local directory: `mkdir -p ~/windows-debug-mount`");
  console.log("3. Get the SSH string from the log, e.g., `ssh <user>@<host>`");
  console.log("4. Use the command below to mount the remote directory:");
  console.log(
    "\n   sshfs <user>@<host>:/D/a/sdk/sdk ~/windows-debug-mount -o reconnect,volname=WindowsDebug\n",
  );
  console.log(
    "   (Replace `<user>@<host>` with your session details and `~/windows-debug-mount` with your directory).",
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
