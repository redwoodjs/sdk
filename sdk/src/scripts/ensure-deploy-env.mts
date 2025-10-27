import { randomBytes } from "crypto";
import { pathExists } from "fs-extra";
import { readFile, writeFile } from "fs/promises";
import { glob } from "glob";
import { parse as parseJsonc } from "jsonc-parser";
import { basename, join, resolve } from "path";
import * as readline from "readline";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { $ } from "../lib/$.mjs";
import { extractAllJson, parseJson } from "../lib/jsonUtils.mjs";
// Define interface for the database info returned by wrangler
interface D1DatabaseInfo {
  uuid?: string;
  name?: string;
  version?: string;
  [key: string]: any;
}

// Define interface for the secrets list returned by wrangler
interface Secret {
  name: string;
  type?: string;
  [key: string]: any;
}

const promptForDeployment = async (): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Handle Ctrl+C (SIGINT)
    rl.on("SIGINT", () => {
      rl.close();
      console.log("\nDeployment cancelled.");
      process.exit(1);
    });

    rl.question("Do you want to proceed with deployment? (y/N): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
};

const generateSecretKey = () => {
  return randomBytes(32).toString("base64");
};

const hasWebAuthn = async () => {
  const files = await glob("src/**/*.{ts,tsx}", { ignore: "node_modules/**" });
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    if (content.includes("WEBAUTHN")) {
      return true;
    }
  }
  return false;
};

const hasD1Database = async () => {
  const files = await glob("src/**/*.{ts,tsx}", { ignore: "node_modules/**" });
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    if (content.includes("env.DB")) {
      return true;
    }
  }
  return false;
};

const hasAuthUsage = async () => {
  const files = await glob("src/**/*.{ts,tsx}", { ignore: "node_modules/**" });
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    if (content.includes("rwsdk/auth")) {
      return true;
    }
  }
  return false;
};

export const ensureDeployEnv = async () => {
  const shouldDeploy = await promptForDeployment();
  if (!shouldDeploy) {
    console.log("Deployment cancelled.");
    process.exit(1);
  }

  console.log("Ensuring deployment environment is ready...");

  const pkg = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf-8"),
  );

  // Read wrangler config
  const wranglerPath = resolve(process.cwd(), "wrangler.jsonc");
  const wranglerConfig = parseJsonc(await readFile(wranglerPath, "utf-8"));

  // Update wrangler name if needed
  if (
    wranglerConfig.name === "__change_me__" ||
    process.env.RWSDK_RENAME_WORKER === "1"
  ) {
    const dirName = basename(process.cwd());
    wranglerConfig.name = dirName;
    console.log(`Set wrangler name to ${dirName}`);
    await writeFile(wranglerPath, JSON.stringify(wranglerConfig, null, 2));
    console.log("Updated wrangler.jsonc configuration");
  }

  if (
    process.env.CLOUDFLARE_ACCOUNT_ID == null ||
    process.env.CLOUDFLARE_API_TOKEN == null
  ) {
    // Trigger account selection prompt if needed
    console.log("Checking Cloudflare account setup...");
    const accountCachePath = join(
      process.cwd(),
      "node_modules/.cache/wrangler/wrangler-account.json",
    );

    // todo(justinvdm): this is a hack to force the account selection prompt,
    // we need to find a better way
    if (!(await pathExists(accountCachePath))) {
      await $("npx", ["wrangler", "d1", "list", "--json"], {
        stdio: "inherit",
      });
    }
  }

  // Create a no-op secret to ensure worker exists
  console.log(`Ensuring worker ${wranglerConfig.name} exists...`);
  await $("echo", ["true"]).pipe("npx", [
    "wrangler",
    "secret",
    "put",
    "TMP_WORKER_CREATED",
  ]);

  // Check D1 database setup
  const needsDatabase = await hasD1Database();
  if (!needsDatabase) {
    console.log("Skipping D1 setup - no env.DB usage detected in codebase");
  } else {
    console.log("Found env.DB usage, checking D1 database setup...");
    try {
      const existingDb = wranglerConfig.d1_databases?.find(
        (db: any) => db.binding === "DB",
      );
      if (
        existingDb &&
        existingDb.database_id !== "__change_me__" &&
        process.env.RWSDK_RENAME_DB !== "1"
      ) {
        console.log(
          "D1 database already configured in wrangler.jsonc, skipping creation",
        );
      } else {
        const suffix = uniqueNamesGenerator({
          dictionaries: [adjectives, animals],
          separator: "-",
          length: 2,
          style: "lowerCase",
        });
        const dbName = `${wranglerConfig.name}-${suffix}`;

        try {
          // Create the database with real-time output so the user can see progress
          console.log(`Creating D1 database: ${dbName}...`);
          const createResult = await $("npx", [
            "wrangler",
            "d1",
            "create",
            dbName,
          ]);

          // Log the result to the console
          console.log(createResult.stdout);

          // Parse all JSON objects from the output
          const allJsonObjects = extractAllJson(createResult.stdout);

          // First look for object with uuid directly
          let dbInfo: D1DatabaseInfo = { uuid: undefined, name: undefined };

          for (const obj of allJsonObjects) {
            if (obj && obj.uuid) {
              dbInfo = obj;
              break;
            }
          }

          // If not found, look for the d1_databases structure
          if (!dbInfo.uuid) {
            for (const obj of allJsonObjects) {
              if (obj && obj.d1_databases && Array.isArray(obj.d1_databases)) {
                const dbConfig = obj.d1_databases.find(
                  (db: any) =>
                    db.binding === "DB" || db.database_name === dbName,
                );
                if (dbConfig && dbConfig.database_id) {
                  dbInfo.uuid = dbConfig.database_id;
                  dbInfo.name = dbConfig.database_name || dbName;
                  break;
                }
              }
            }
          }

          if (!dbInfo.uuid) {
            throw new Error(
              "Failed to extract database ID from wrangler output",
            );
          }

          // Update wrangler config with database info, preserving other databases
          const existingDatabases = wranglerConfig.d1_databases || [];
          wranglerConfig.d1_databases = [
            ...existingDatabases.filter((db: any) => db.binding !== "DB"),
            {
              binding: "DB",
              database_name: dbName,
              database_id: dbInfo.uuid,
            },
          ];

          await writeFile(
            wranglerPath,
            JSON.stringify(wranglerConfig, null, 2),
          );
          console.log("Updated wrangler.jsonc configuration");
          console.log(
            `D1 database configured: ${dbName} with ID: ${dbInfo.uuid}`,
          );
        } catch (error) {
          console.error(
            "Failed to create D1 database:",
            error instanceof Error ? error.message : String(error),
          );
          console.error("Please create it manually:");
          console.error("1. Run: npx wrangler d1 create <your-db-name>");
          console.error("2. Update wrangler.jsonc with the database details");
          process.exit(1);
        }
      }
    } catch (error) {
      console.error("Failed to create D1 database. Please create it manually:");
      console.error("1. Run: npx wrangler d1 create <your-db-name>");
      console.error("2. Update wrangler.jsonc with the database details");
      process.exit(1);
    }
  }

  // Check AUTH_SECRET_KEY setup
  if (!(await hasAuthUsage())) {
    console.log(
      "Skipping AUTH_SECRET_KEY setup - no auth usage detected in codebase",
    );
  } else {
    console.log("Found auth usage, checking secret setup...");
    try {
      // Get list of all secrets
      let secretsResult: ExecaReturnValue<string>;
      try {
        secretsResult = await $("npx", [
          "wrangler",
          "secret",
          "list",
          "--format=json",
        ]);
      } catch (e: any) {
        if (e.stderr.includes("No secrets found")) {
          secretsResult = await $("npx", [
            "wrangler",
            "secret",
            "list",
            "--format=json",
          ]);
        } else {
          throw e;
        }
      }
      const existingSecrets = parseJson<Secret[]>(secretsResult.stdout, []).map(
        (secret) => secret.name,
      );

      // Check if AUTH_SECRET_KEY already exists
      if (existingSecrets.includes("AUTH_SECRET_KEY")) {
        console.log(
          "AUTH_SECRET_KEY secret already exists in Cloudflare, skipping",
        );
      } else {
        // Secret doesn't exist, create it
        const secretKey = generateSecretKey();
        // Use the same pattern as TMP_WORKER_CREATED for consistency
        await $("echo", [`"${secretKey}"`]).pipe("npx", [
          "wrangler",
          "secret",
          "put",
          "AUTH_SECRET_KEY",
        ]);
        console.log("Set AUTH_SECRET_KEY secret");
      }
    } catch (error) {
      console.error(
        "Failed to set up AUTH_SECRET_KEY. Please configure it manually:",
      );
      console.error(
        "1. Generate a secret key: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
      console.error(
        "2. Set the secret: npx wrangler secret put AUTH_SECRET_KEY",
      );
      process.exit(1);
    }
  }

  // Check WebAuthn setup
  const needsWebAuthn = await hasWebAuthn();
  if (!needsWebAuthn) {
    console.log(
      "Skipping WebAuthn setup - no WEBAUTHN usage detected in codebase",
    );
  } else {
    console.log("Found WEBAUTHN usage, checking WebAuthn setup...");
    try {
      wranglerConfig.vars = wranglerConfig.vars || {};
      if (wranglerConfig.vars.WEBAUTHN_APP_NAME === wranglerConfig.name) {
        console.log(
          `WEBAUTHN_APP_NAME already set to "${wranglerConfig.name}" in wrangler.jsonc`,
        );
      } else {
        wranglerConfig.vars.WEBAUTHN_APP_NAME = wranglerConfig.name;
        await writeFile(wranglerPath, JSON.stringify(wranglerConfig, null, 2));
        console.log("Updated wrangler.jsonc configuration");
        console.log(`Set WEBAUTHN_APP_NAME to ${wranglerConfig.name}`);
      }
    } catch (error) {
      console.error("Failed to set up WebAuthn. Please configure it manually:");
      console.error("Add to wrangler.jsonc vars:");
      console.error(
        `   "vars": { "WEBAUTHN_APP_NAME": "${wranglerConfig.name}" }`,
      );
      process.exit(1);
    }
  }

  if (pkg.scripts?.["migrate:prd"]) {
    console.log("Checking migration status...");
    try {
      // Get the database name from wrangler config
      const dbConfig = wranglerConfig.d1_databases?.find(
        (db: any) => db.binding === "DB",
      );
      if (!dbConfig) {
        throw new Error("No D1 database configuration found in wrangler.jsonc");
      }

      // Check remote migrations status
      let migrationStatus: ExecaReturnValue<string>;
      try {
        migrationStatus = await $("npx", [
          "wrangler",
          "d1",
          "migrations",
          "list",
          dbConfig.database_name,
          "--remote",
        ]);
      } catch (e: any) {
        if (e.stderr.includes("No migrations found")) {
          migrationStatus = await $("npx", [
            "wrangler",
            "d1",
            "migrations",
            "list",
            dbConfig.database_name,
            "--remote",
          ]);
        } else {
          throw e;
        }
      }

      // If stdout includes "No migrations found", this is a fresh database
      if (migrationStatus.stdout?.includes("No migrations present")) {
        console.log("No migrations found.");
      } else if (migrationStatus.stdout?.includes("Migrations to be applied")) {
        await $({ stdio: "inherit" })`npm run migrate:prd`;
      } else {
        console.log("Migrations are up to date.");
      }
    } catch (error) {
      console.error("\n❌ Error checking migration status:");
      console.error(error);
      process.exit(1);
    }
  }

  console.log("\nDeployment initialization complete!");
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  ensureDeployEnv();
}
