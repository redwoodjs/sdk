import { glob } from "glob";
import path from "path";
import ts from "typescript";

/**
 * Gets all source file paths by parsing tsconfig.json using TypeScript's compiler API.
 * Falls back to a glob pattern if tsconfig parsing fails.
 *
 * @param rootDir - The root directory to search from (defaults to current working directory)
 * @returns Promise<string[]> - Array of source file paths
 */
export async function getSrcPaths(
  rootDir: string = process.cwd(),
): Promise<string[]> {
  try {
    const configPath = ts.findConfigFile(
      rootDir,
      ts.sys.fileExists,
      "tsconfig.json",
    );

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

      if (!configFile.error) {
        // Parse tsconfig
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath),
        );

        if (parsed.fileNames && parsed.fileNames.length > 0) {
          return parsed.fileNames;
        }
      }
    }
  } catch (error) {
    console.warn(
      "Failed to parse tsconfig.json, falling back to glob pattern:",
      error,
    );
  }

  // Fallback to glob pattern
  try {
    const globPattern = path.join(rootDir, "src/**/*.{ts,mts,tsx,jsx,mjs,js}");
    const files = await glob(globPattern, {
      ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
      absolute: true,
      nodir: true,
    });
    return files;
  } catch (error) {
    console.error("Failed to get source paths with glob pattern:", error);
    return [];
  }
}

/**
 * Synchronous version of getSrcPaths
 *
 * @param rootDir - The root directory to search from (defaults to current working directory)
 * @returns string[] - Array of source file paths
 */
export function getSrcPathsSync(rootDir: string = process.cwd()): string[] {
  try {
    // Try TypeScript compiler API approach first
    const configPath = ts.findConfigFile(
      rootDir,
      ts.sys.fileExists,
      "tsconfig.json",
    );

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

      if (!configFile.error) {
        // Parse tsconfig
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath),
        );

        if (parsed.fileNames && parsed.fileNames.length > 0) {
          return parsed.fileNames;
        }
      }
    }
  } catch (error) {
    console.warn(
      "Failed to parse tsconfig.json, falling back to glob pattern:",
      error,
    );
  }

  // Fallback to glob pattern
  try {
    const globPattern = path.join(rootDir, "src/**/*.{ts,mts,tsx,jsx,mjs,js}");
    const files = glob.sync(globPattern, {
      ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
      absolute: true,
    });
    return files;
  } catch (error) {
    console.error("Failed to get source paths with glob pattern:", error);
    return [];
  }
}
