import { execa } from "execa";
import { setTimeout } from "node:timers/promises";

console.log("🚀 Starting debug spawn script...");

const CWD = process.cwd();
const command = "pnpm";
const commandArgs = ["run", "dev"];

const testCases = [
  {
    description: "1. Default options (similar to original)",
    isShell: false,
    command: [command, commandArgs],
    options: {
      cwd: CWD,
      stdio: "pipe",
      all: true,
      detached: true,
    },
  },
  {
    description: "2. `detached: false`",
    isShell: false,
    command: [command, commandArgs],
    options: {
      cwd: CWD,
      stdio: "pipe",
      all: true,
      detached: false,
    },
  },
  {
    description: "3. `shell: true` (using default shell, cmd.exe)",
    isShell: true,
    command: `${command} ${commandArgs.join(" ")}`,
    options: {
      cwd: CWD,
      stdio: "pipe",
      all: true,
      shell: true,
    },
  },
  {
    description: "4. `shell: true` (explicitly PowerShell)",
    isShell: true,
    command: `${command} ${commandArgs.join(" ")}`,
    options: {
      cwd: CWD,
      stdio: "pipe",
      all: true,
      shell: "pwsh.exe",
    },
  },
  {
    description: "5. Using `pnpm.cmd` directly",
    isShell: false,
    command: ["pnpm.cmd", commandArgs],
    options: {
      cwd: CWD,
      stdio: "pipe",
      all: true,
      detached: true,
    },
  },
  {
    description: "6. `stdio: 'inherit'` (should print directly to console)",
    isShell: false,
    command: [command, commandArgs],
    options: {
      cwd: CWD,
      stdio: "inherit",
      detached: true,
    },
  },
  {
    description: "7. `stdio: 'overlapped'` (windows-specific)",
    isShell: false,
    command: [command, commandArgs],
    options: {
      cwd: CWD,
      stdio: "overlapped",
      detached: true,
    },
  },
];

async function runTest({ description, isShell, command, options }) {
  console.log(`\n--- Running Test: ${description} ---`);
  console.log("Command:", command);
  console.log("Options:", options);

  let childProcess;
  try {
    if (isShell) {
      childProcess = execa(command, options);
    } else {
      childProcess = execa(command[0], command[1], options);
    }

    let outputReceived = false;

    // The 'all' stream is only available when options.all is true
    if (childProcess.all) {
      childProcess.all.on("data", (data) => {
        outputReceived = true;
        console.log(`[${description}] all stream:`, data.toString().trim());
      });
    }

    if (childProcess.stdout) {
      childProcess.stdout.on("data", (data) => {
        outputReceived = true;
        console.log(`[${description}] stdout stream:`, data.toString().trim());
      });
    }
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data) => {
        outputReceived = true;
        console.log(`[${description}] stderr stream:`, data.toString().trim());
      });
    }

    childProcess.on("spawn", () => {
      console.log(
        `[${description}] Process spawned with PID: ${childProcess.pid}`
      );
    });

    childProcess.on("exit", (code, signal) => {
      console.log(
        `[${description}] Process exited with code ${code}, signal ${signal}`
      );
    });

    childProcess.on("error", (err) => {
      console.error(`[${description}] Process error:`, err);
      outputReceived = true; // An error is a form of output
    });

    // Let the process run for a few seconds to see if it outputs anything
    await setTimeout(5000);

    if (!outputReceived) {
      console.log(`[${description}] No output received after 5 seconds.`);
    }
  } catch (e) {
    console.error(`[${description}] Error during execa call:`, e);
  } finally {
    if (childProcess && !childProcess.killed) {
      console.log(`[${description}] Killing process...`);
      childProcess.kill();
    }
  }
}

async function main() {
  for (const testCase of testCases) {
    await runTest(testCase);
  }
  console.log("\n--- All tests complete ---");
}

main();
