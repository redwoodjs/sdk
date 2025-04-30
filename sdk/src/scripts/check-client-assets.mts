import { $ } from "../lib/$.mjs";
import { readFile } from "fs/promises";
import { join } from "path";

// Get URL from args or use default
const BASE_URL = process.argv[2] || "http://localhost:5173";

export const checkAssets = async () => {
  try {
    // Build the project
    console.log("Building project...");
    const buildOutput = await $`pnpm build`;
    console.log(buildOutput.stdout);

    // Parse manifest file to get assets
    const manifestPath = join(process.cwd(), "dist/client/.vite/manifest.json");
    const manifestJson = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestJson);

    // Extract all assets from manifest
    const assets = new Set<string>();
    for (const [_, value] of Object.entries<any>(manifest)) {
      if (typeof value === "object" && value !== null) {
        // Handle file property
        if (value.file) {
          assets.add(`/${value.file}`);
        }

        // Handle CSS and other imports
        if (value.css) {
          value.css.forEach((css: string) => assets.add(`/${css}`));
        }

        // Handle dynamic imports
        if (value.imports) {
          value.imports.forEach((imp: string) => {
            const importedAsset = manifest[imp];
            if (importedAsset && importedAsset.file) {
              assets.add(`/${importedAsset.file}`);
            }
          });
        }
      }
    }

    const assetPaths = Array.from(assets);
    console.log(`Found ${assetPaths.length} assets:`);
    assetPaths.forEach((asset) => console.log(`- ${asset}`));

    // Validate BASE_URL
    if (!BASE_URL.startsWith("http")) {
      throw new Error(
        `Invalid BASE_URL: "${BASE_URL}". URL must start with http:// or https://`,
      );
    }

    // Check each asset
    console.log(`\nChecking assets on ${BASE_URL}...`);

    let failed = 0;

    for (const asset of assetPaths) {
      const assetUrl = `${BASE_URL}${asset}`;
      process.stdout.write(`Checking ${asset}... `);

      try {
        const result = await $`curl -s -I ${assetUrl}`;
        const stdout = result.stdout || "";
        const statusLine = stdout.split("\n")[0];
        const statusCode = statusLine.match(/HTTP\/[\d.]+ (\d+)/)?.[1];

        if (
          statusCode &&
          parseInt(statusCode) >= 200 &&
          parseInt(statusCode) < 400
        ) {
          console.log("✅");
        } else {
          console.log("❌");
          console.log(`  Response: ${statusLine || "Unknown status"}`);
          failed++;
        }
      } catch (error) {
        console.log("❌");
        console.log(
          `  Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        failed++;
      }
    }

    // Final summary
    if (failed > 0) {
      console.log(
        `\n❌ ${failed} of ${assetPaths.length} assets failed to load`,
      );
      process.exit(1);
    } else {
      console.log(`\n✅ All ${assetPaths.length} assets loaded successfully`);
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  // Explicitly exit to avoid hanging processes
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  checkAssets();
}
