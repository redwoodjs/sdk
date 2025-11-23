import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { expect, test } from "vitest";

/**
 * Derive the playground directory from import.meta.url by finding the nearest package.json
 */
function getPlaygroundDirFromImportMeta(importMetaUrl: string): string {
  const testFilePath = fileURLToPath(importMetaUrl);
  let currentDir = path.dirname(testFilePath);
  // Walk up the tree from the test file's directory
  while (path.dirname(currentDir) !== currentDir) {
    // Check if a package.json exists in the current directory
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error(
    `Could not determine playground directory from import.meta.url: ${importMetaUrl}. ` +
      `Failed to find a package.json in any parent directory.`,
  );
}

test("tsc reports error for undefined route", () => {
  const projectDir = getPlaygroundDirFromImportMeta(import.meta.url);

  // Generate types first to ensure worker-configuration.d.ts exists
  try {
    execSync("pnpm generate", {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (error: any) {
    // Ignore errors from generate - it might fail if wrangler isn't configured,
    // but we can still test tsc if the types file exists
  }

  let tscOutput = "";
  let tscExitCode = 0;

  try {
    execSync("tsc --noEmit", {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (error: any) {
    tscExitCode = error.status || error.code || 1;
    tscOutput = error.stdout?.toString() || error.stderr?.toString() || "";
  }

  // tsc should exit with a non-zero code when there are errors
  expect(tscExitCode).not.toBe(0);

  // Count the number of errors in the output
  // TypeScript error messages typically start with the file path followed by a colon and line number
  const errorMatches = tscOutput.match(/\.tsx?:\d+:\d+ - error/g);
  const errorCount = errorMatches ? errorMatches.length : 0;

  // Should have exactly one error
  expect(errorCount).toBe(1);

  // The error should be about the undefined route
  expect(tscOutput).toContain("/undefined-route");
  expect(tscOutput).toMatch(/error TS\d+:/);
});
