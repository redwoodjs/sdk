import { $ } from "../lib/$.mjs";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { randomBytes } from "crypto";
import { glob } from "glob";
import { parse as parseJsonc } from "jsonc-parser";

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

export const ensureDeployEnv = async () => {
  console.log("Ensuring deployment environment is ready...");

  const pkg = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf-8"),
  );

  // Read wrangler config
  const wranglerPath = resolve(process.cwd(), "wrangler.jsonc");
  const wranglerConfig = parseJsonc(await readFile(wranglerPath, "utf-8"));

  // Track if we need to update the file
  let needsUpdate = false;

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
      if (existingDb && existingDb.database_id !== "__change_me__") {
        console.log(
          "D1 database already configured in wrangler.jsonc, skipping creation",
        );
      } else {
        const dbName = wranglerConfig.name + "-db";
        await $`wrangler d1 create ${dbName}`;
        const result = await $`wrangler d1 info ${dbName} --json`;
        const dbInfo = JSON.parse(result.stdout ?? "{}");

        if (!dbInfo.uuid) {
          throw new Error("Failed to get database ID from wrangler output");
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

        console.log(`Created D1 database: ${dbName}`);
      }
    } catch (error) {
      console.error("Failed to create D1 database. Please create it manually:");
      console.error("1. Run: wrangler d1 create <your-db-name>");
      console.error("2. Update wrangler.jsonc with the database details");
      process.exit(1);
    }
    needsUpdate = true;
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
      // Check if AUTH_SECRET_KEY already exists
      try {
        await $`wrangler secret get AUTH_SECRET_KEY`;
        console.log(
          "AUTH_SECRET_KEY secret already exists in Cloudflare, skipping",
        );
      } catch {
        // Secret doesn't exist, create it
        const secretKey = generateSecretKey();
        await $`echo ${secretKey} | wrangler secret put AUTH_SECRET_KEY`;
        console.log("Set AUTH_SECRET_KEY secret");
      }

      // Check WEBAUTHN_APP_NAME
      wranglerConfig.vars = wranglerConfig.vars || {};
      if (wranglerConfig.vars.WEBAUTHN_APP_NAME === wranglerConfig.name) {
        console.log(
          `WEBAUTHN_APP_NAME already set to "${wranglerConfig.name}" in wrangler.jsonc`,
        );
      } else {
        wranglerConfig.vars.WEBAUTHN_APP_NAME = wranglerConfig.name;
        console.log(`Set WEBAUTHN_APP_NAME to ${wranglerConfig.name}`);
      }
    } catch (error) {
      console.error("Failed to set up WebAuthn. Please configure it manually:");
      console.error(
        "1. Generate a secret key: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
      console.error("2. Set the secret: wrangler secret put AUTH_SECRET_KEY");
      console.error("3. Add to wrangler.jsonc vars:");
      console.error(
        `   "vars": { "WEBAUTHN_APP_NAME": "${wranglerConfig.name}" }`,
      );
      process.exit(1);
    }
    needsUpdate = true;
  }

  // Only write wrangler config if changes were made
  if (needsUpdate) {
    await writeFile(wranglerPath, JSON.stringify(wranglerConfig, null, 2));
    console.log("Updated wrangler.jsonc configuration");
  }

  if (pkg.scripts?.["migrate:deploy"]) {
    console.log("\nRunning production migrations...");
    await $`npm run migrate:deploy`;
  }

  console.log("\nDeployment initialization complete!");
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  ensureDeployEnv();
}
