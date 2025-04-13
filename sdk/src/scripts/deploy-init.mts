import { $ } from "../lib/$.mjs";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { randomBytes } from "crypto";
import { createInterface } from "readline";
import { glob } from "glob";

const generateSecretKey = () => {
  return randomBytes(32).toString("base64");
};

const askQuestion = async (question: string): Promise<string> => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

const hasWebAuthn = async () => {
  const files = await glob("src/**/*.{ts,tsx}", { ignore: "node_modules/**" });
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    if (content.includes("@redwoodsdk/auth") || content.includes("webauthn")) {
      return true;
    }
  }
  return false;
};

export const initDeploy = async () => {
  console.log("Initializing deployment environment...");

  const pkg = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf-8"),
  );

  // Read wrangler config
  const wranglerPath = resolve(process.cwd(), "wrangler.jsonc");
  const wranglerConfig = JSON.parse(await readFile(wranglerPath, "utf-8"));

  // Only set up auth if WebAuthn is being used
  if (await hasWebAuthn()) {
    // Set up secrets
    const secretKey = generateSecretKey();
    await $`echo ${secretKey} | wrangler secret put AUTH_SECRET_KEY`;
    console.log("Set AUTH_SECRET_KEY secret");

    // Set WEBAUTHN_APP_NAME to match wrangler name
    wranglerConfig.vars = wranglerConfig.vars || {};
    wranglerConfig.vars.WEBAUTHN_APP_NAME = wranglerConfig.name;
    await writeFile(wranglerPath, JSON.stringify(wranglerConfig, null, 2));
    console.log(`Set WEBAUTHN_APP_NAME to ${wranglerConfig.name}`);
  }

  if (pkg.scripts?.["migrate:deploy"]) {
    console.log("\nRunning production migrations...");
    await $`npm run migrate:deploy`;
  }

  console.log("\nDeployment initialization complete!");
  console.log(
    "\nNote: If you want to enable bot protection via Cloudflare Turnstile:",
  );
  console.log("1. Visit https://dash.cloudflare.com/?to=/:account/turnstile");
  console.log("2. Create a new widget with 'invisible' mode");
  console.log("3. Add your domain to allowed hostnames");
  console.log("4. Set the site key and secret key:");
  console.log("   wrangler secret put TURNSTILE_SECRET_KEY");
  console.log("   Update your LoginPage.tsx with the site key");
  console.log();

  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  initDeploy();
}
