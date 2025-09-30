import debug from "debug";
import { join } from "path";
import { fileURLToPath } from "url";
import { runSmokeTests } from "../lib/smokeTests/runSmokeTests.mjs";
import { PackageManager, SmokeTestOptions } from "../lib/smokeTests/types.mjs";
import { isRunningInCI } from "../lib/smokeTests/utils.mjs";

// Set up debug logging
if (!process.env.DEBUG) {
  debug.enable("rwsdk:smoke");
}

const log = debug("rwsdk:smoke");

// Run the smoke test if this file is executed directly
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  log("Command line arguments: %O", args);

  // Check for CI flag first
  const ciFlag = args.includes("--ci");

  // Set initial default values (sync will be determined below)
  const options: SmokeTestOptions = {
    skipDev: false,
    skipRelease: false,
    skipClient: false,
    projectDir: undefined,
    artifactDir: join(process.cwd(), ".artifacts"), // Default to .artifacts in current directory
    keep: isRunningInCI(ciFlag), // Default to true in CI environments
    headless: true,
    ci: ciFlag,
    bail: false, // Default to false - continue tests even if some fail
    copyProject: false, // Default to false - don't copy project to artifacts
    realtime: false, // Default to false - don't just test realtime
    skipHmr: false, // Default to false - run HMR tests
    skipStyleTests: false,
    packageManager: "pnpm", // Default to pnpm
    // sync: will be set below
  };

  // Log if we're in CI
  if (isRunningInCI(ciFlag)) {
    log("Running in CI environment, keeping test directory by default");
  }

  // Track if user explicitly set sync or no-sync
  let syncExplicit: boolean | undefined = undefined;

  // Process arguments in order
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--skip-dev") {
      options.skipDev = true;
    } else if (arg === "--skip-release") {
      options.skipRelease = true;
    } else if (arg === "--skip-client") {
      options.skipClient = true;
    } else if (arg === "--skip-hmr") {
      options.skipHmr = true;
    } else if (arg === "--skip-style-tests") {
      options.skipStyleTests = true;
    } else if (arg === "--keep") {
      options.keep = true;
    } else if (arg === "--no-headless") {
      options.headless = false;
    } else if (arg === "--copy-project") {
      options.copyProject = true;
    } else if (arg === "--ci") {
      // Already handled above, just skip
    } else if (arg === "--bail") {
      options.bail = true;
    } else if (arg === "--realtime") {
      options.realtime = true;
    } else if (arg === "--help" || arg === "-h") {
      // Display help text
      console.log(`
Smoke Test Usage:
  node smoke-test.mjs [options]

Options:
  --skip-dev              Skip testing the local development server
  --skip-release          Skip testing the release/production deployment
  --skip-client           Skip client-side tests, only run server-side checks
  --skip-hmr              Skip hot module replacement (HMR) tests
  --skip-style-tests      Skip stylesheet-related tests
  --path=PATH             Project directory to test
  --artifact-dir=DIR      Directory to store test artifacts (default: .artifacts)
  --package-manager=MGR   Package manager to use (pnpm, npm, yarn, yarn-classic; default: pnpm)
  --keep                  Keep temporary test directory after tests complete
  --no-headless           Run browser tests with GUI (not headless)
  --sync                  Force syncing SDK code to test project
  --ci                    Run in CI mode (keeps temp dirs, sets headless)
  --bail                  Stop on first test failure
  --copy-project          Copy the project to the artifacts directory
  --realtime              Only run realtime smoke tests, skip initial tests
  --help                  Show this help message
`);
      process.exit(0);
    } else if (arg.startsWith("--path=")) {
      options.projectDir = arg.substring(7);
    } else if (arg.startsWith("--artifact-dir=")) {
      options.artifactDir = arg.substring(15);
    } else if (arg.startsWith("--package-manager=")) {
      const pm = arg.substring(18) as PackageManager;
      if (!["pnpm", "npm", "yarn", "yarn-classic"].includes(pm)) {
        throw new Error(`Invalid package manager: ${pm}`);
      }
      options.packageManager = pm;
    } else {
      // Throw error for unknown options instead of just warning
      log("Unknown option: %s", arg);
      throw new Error(
        `Unknown option: ${arg}. Use --help to see available options.`,
      );
    }
  }

  // Async IIFE to determine sync default and run main
  (async () => {
    if (syncExplicit !== undefined) {
      options.sync = syncExplicit;
    } else {
      // Determine default for sync: true if cwd has package.json with name 'rwsdk', otherwise false
      let syncDefault = false;
      const pkgPath = join(process.cwd(), "package.json");
      log(`[sync default] Checking for package.json at: %s`, pkgPath);
      try {
        const pkgRaw = await import("fs/promises").then((fs) =>
          fs.readFile(pkgPath, "utf8"),
        );
        log(`[sync default] Read package.json: %s`, pkgRaw);
        const pkg = JSON.parse(pkgRaw);
        if (pkg && pkg.name === "rwsdk") {
          log(
            `[sync default] package.json name is 'rwsdk', setting syncDefault = true`,
          );
          syncDefault = true;
        } else {
          log(
            `[sync default] package.json name is not 'rwsdk', setting syncDefault = false`,
          );
        }
      } catch (e) {
        log(`[sync default] Could not read package.json or parse name: %O`, e);
        log(`[sync default] Defaulting syncDefault = false`);
      }
      log(`[sync default] Final syncDefault value: %s`, syncDefault);
      options.sync = syncDefault;
    }

    log("Parsed options: %O", options);

    // Run the smoke tests with the parsed options
    try {
      await runSmokeTests(options);
    } catch (error) {
      log("Error running smoke tests: %O", error);
      console.error(
        `Error running smoke tests: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  })();
}
