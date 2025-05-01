import { $ } from "../lib/$.mjs";
import { readFile } from "fs/promises";
import { join } from "path";

// Get URL from args (required)
const TARGET_URL = process.argv[2];

if (!TARGET_URL) {
  console.error("Error: Please provide a URL to check");
  process.exit(1);
}

// Extract base URL from the target URL
const getBaseUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch (error) {
    console.error("Invalid URL format:", url);
    process.exit(1);
    return ""; // This line will never be reached, but TypeScript needs it
  }
};

// Extract JS imports from HTML content
const extractJsImports = (html: string): string[] => {
  const imports: string[] = [];

  // Find inline script tags with imports
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1];

    // Look for import statements
    const importRegex = /import[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    let importMatch;

    while ((importMatch = importRegex.exec(scriptContent)) !== null) {
      if (importMatch[1] && !imports.includes(importMatch[1])) {
        imports.push(importMatch[1]);
      }
    }

    // Also check for dynamic imports
    const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let dynamicMatch;

    while ((dynamicMatch = dynamicImportRegex.exec(scriptContent)) !== null) {
      if (dynamicMatch[1] && !imports.includes(dynamicMatch[1])) {
        imports.push(dynamicMatch[1]);
      }
    }
  }

  return imports;
};

// Check if a path is in the manifest
const checkInManifest = (path: string, manifest: any): boolean => {
  // Remove query params and hash
  const cleanPath = path.split("?")[0].split("#")[0];

  // Strip leading slash if present
  const assetPath = cleanPath.startsWith("/")
    ? cleanPath.substring(1)
    : cleanPath;

  // Direct check
  for (const [_, entry] of Object.entries<any>(manifest)) {
    if (typeof entry === "object" && entry !== null) {
      if (entry.file === assetPath) {
        return true;
      }
    }
  }

  return false;
};

export const checkAssets = async () => {
  try {
    // Compute base URL
    const BASE_URL = getBaseUrl(TARGET_URL);
    console.log(`Base URL: ${BASE_URL}`);

    if (!process.env.NO_RELEASE) {
      // First run release to ensure manifest is created
      console.log("\nRunning release to generate manifest...");
      // Run pnpm release in interactive mode by passing stdio 'inherit'
      await $({ stdio: "inherit" })`pnpm release`;
    }

    // Fetch the target page
    console.log(`\nFetching content from ${TARGET_URL}...`);
    const pageContent = await $`curl -s ${TARGET_URL}`;

    if (!pageContent.stdout) {
      throw new Error("Failed to fetch page content");
    }

    // Extract JS imports
    const jsImports = extractJsImports(pageContent.stdout);
    console.log(`\nFound ${jsImports.length} JavaScript imports:`);
    jsImports.forEach((path) => console.log(`- ${path}`));

    if (jsImports.length === 0) {
      console.log("No JavaScript imports found in inline scripts");
      process.exit(0);
    }

    // Parse manifest file
    const manifestPath = join(process.cwd(), "dist/client/.vite/manifest.json");
    const manifestJson = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestJson);

    // Check each JS import
    console.log("\nChecking JavaScript imports:");
    let failed = 0;

    for (const jsPath of jsImports) {
      process.stdout.write(`Checking ${jsPath}... `);

      // Construct full URL (handling relative paths)
      const fullUrl = jsPath.startsWith("http")
        ? jsPath
        : `${BASE_URL}${jsPath.startsWith("/") ? "" : "/"}${jsPath}`;

      try {
        // Check if the file exists
        const result = await $`curl -s -I ${fullUrl}`;
        const stdout = result.stdout || "";
        const statusLine = stdout.split("\n")[0];
        const statusCode = statusLine.match(/HTTP\/[\d.]+ (\d+)/)?.[1];

        const exists =
          statusCode &&
          parseInt(statusCode) >= 200 &&
          parseInt(statusCode) < 400;
        const inManifest = checkInManifest(jsPath, manifest);

        if (exists && inManifest) {
          console.log("✅ (accessible and in manifest)");
        } else if (exists) {
          console.log("⚠️ (accessible but NOT in manifest)");
        } else if (inManifest) {
          console.log("⚠️ (in manifest but NOT accessible)");
          failed++;
        } else {
          console.log("❌ (NOT accessible and NOT in manifest)");
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
        `\n❌ ${failed} of ${jsImports.length} JavaScript imports failed checks`,
      );
      process.exit(1);
    } else {
      console.log(
        `\n✅ All ${jsImports.length} JavaScript imports passed checks`,
      );
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  checkAssets();
}
