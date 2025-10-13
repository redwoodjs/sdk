#!/usr/bin/env -S npx tsx

import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const fiveMinutes = 5 * 60 * 1000;
const tenSeconds = 10 * 1000;
const pollInterval = tenSeconds;
const timeout = fiveMinutes;

async function main() {
  console.log("🔍 Checking for dependency 'gh'...");
  checkForCommand(
    "gh",
    "Please install the GitHub CLI: https://cli.github.com/",
  );
  console.log("✅ Dependency found.");

  console.log("\n🔒 Authenticating with GitHub...");
  try {
    execSync("gh auth status", { stdio: "inherit" });
  } catch (error) {
    console.error("Authentication failed. Please run 'gh auth login'.");
    process.exit(1);
  }

  const branch = execSync("git branch --show-current").toString().trim();
  console.log(
    `\n🚀 Triggering the 'Windows Debug Session' on branch '${branch}'...`,
  );
  execSync(`gh workflow run windows-debug.yml --ref "${branch}"`);

  console.log("⏳ Waiting for the workflow run to be created...");
  await sleep(5000);

  const runId = await getRunId(branch);
  const runUrl = execSync(`gh run view ${runId} --json url -q .url`)
    .toString()
    .trim();
  console.log(`✅ Workflow triggered successfully: ${runUrl}`);

  console.log("\n📡 Waiting for tmate SSH connection string...");
  const sshConnectionString = await getSshConnectionString(runId);
  const sshTarget = sshConnectionString.split(" ")[1]; // Extracts the 'user@host.tmate.io' part
  const [username, host] = sshTarget.split("@");

  console.log("\n📝 Generating VS Code SFTP configuration...");
  const sftpConfig = {
    name: "Windows Debug Session",
    host: host,
    protocol: "sftp",
    port: 22,
    username: username,
    remotePath: "D:/a/sdk/sdk",
    uploadOnSave: true,
    useTempFile: false,
    openSsh: true,
  };

  const vscodeDir = join(process.cwd(), ".vscode");
  mkdirSync(vscodeDir, { recursive: true });
  writeFileSync(
    join(vscodeDir, "sftp.json"),
    JSON.stringify(sftpConfig, null, 2),
  );
  console.log("✅ SFTP configuration written to .vscode/sftp.json");

  console.log("\n\n=======================================================");
  console.log("         🚀 Windows Debug Environment is Ready! 🚀");
  console.log("=======================================================");
  console.log('\n1. Install the "SFTP" extension by Natizyskunk in VS Code.');
  console.log(
    '\n2. Open the Command Palette (Cmd+Shift+P) and run "SFTP: List All".',
  );
  console.log('   Select the "Windows Debug Session" to browse remote files.');
  console.log(
    "\n3. To open an interactive shell, paste this in a new terminal:",
  );
  console.log(`\n  ${sshConnectionString}\n`);
  console.log(
    "4. When you are finished, remember to cancel the GitHub Actions workflow!",
  );
  console.log("=======================================================\n");
}

// --- Helper Functions ---

function checkForCommand(command: string, helpMessage: string) {
  try {
    execSync(`which ${command}`, { stdio: "pipe" });
  } catch (error) {
    console.error(`\n❌ Command not found: '${command}'`);
    console.error(helpMessage);
    process.exit(1);
  }
}

async function getRunId(branch: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    try {
      const result = execSync(
        `gh run list --workflow="windows-debug.yml" --branch="${branch}" --limit 1 --json databaseId -q '.[0].databaseId'`,
      ).toString();
      const runId = result.trim();
      if (runId) return runId;
    } catch (e) {
      // ignore and retry
    }
    await sleep(2000);
  }
  console.error("❌ Could not find a recent workflow run.");
  process.exit(1);
}

async function getSshConnectionString(runId: string): Promise<string> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const log = execSync(`gh run view ${runId} --log`, {
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      const match = log.match(/ssh\s+[a-zA-Z0-9\S]+@[\w\.]+\.tmate\.io/);
      if (match && match[0]) {
        return match[0];
      }
    } catch (error) {
      // Ignore and retry
    }
    console.log("   Still waiting...");
    await sleep(pollInterval);
  }
  console.error(
    "❌ Workflow timed out without providing an SSH connection string.",
  );
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("\n❌ An unexpected error occurred:", error);
  process.exit(1);
});
