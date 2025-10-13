#!/usr/bin/env -S npx tsx

import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as readline from "readline";

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
  console.log(`✅ Workflow triggered successfully.`);

  console.log("\n\n=======================================================");
  console.log("         ACTION REQUIRED: Get SSH Connection String");
  console.log("=======================================================");
  console.log("\n1. Open this URL in your browser to view the live log:");
  console.log(`\n   ${runUrl}\n`);
  console.log(
    "2. Wait for the tmate session to start. You will see a line like:",
  );
  console.log('   "ssh <some-long-string>@<some-host>.tmate.io"');

  const sshConnectionString = await promptForSshString();

  console.log("\n📝 Generating VS Code SFTP configuration...");
  const sshTarget = sshConnectionString.split(" ")[1];
  const [username, host] = sshTarget.split("@");

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
    "\n3. To open an interactive shell, use the connection string you just pasted:",
  );
  console.log(`\n  ${sshConnectionString}\n`);
  console.log(
    "4. When you are finished, remember to cancel the GitHub Actions workflow!",
  );
  console.log("=======================================================\n");

  process.exit(0);
}

// --- Helper Functions ---

function promptForSshString(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "\n3. Paste the full SSH connection string here: ",
      (answer) => {
        rl.close();
        resolve(answer.trim());
      },
    );
  });
}

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("\n❌ An unexpected error occurred:", error);
  process.exit(1);
});
