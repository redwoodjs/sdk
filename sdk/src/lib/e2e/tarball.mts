import { $ } from "execa";
import fs from "node:fs";
import path from "node:path";
import { copyProjectToTempDir } from "./environment.mjs";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import { createHash } from "crypto";
import { ROOT_DIR } from "../constants.mjs";

const log = (message: string) => console.log(message);

interface SetupTarballOptions {
  projectDir: string;
  packageManager?: "pnpm" | "npm" | "yarn";
}

interface TarballEnvironment {
  targetDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Copies wrangler cache from monorepo to temp directory for deployment tests
 */
async function copyWranglerCache(
  targetDir: string,
  sdkRoot: string,
): Promise<void> {
  try {
    // Find the monorepo root by starting from the SDK root directory
    // and walking up to find the monorepo root
    let currentDir = path.resolve(sdkRoot);
    let monorepoRoot = null;

    // Walk up the directory tree to find the monorepo root
    while (currentDir !== path.dirname(currentDir)) {
      const nodeModulesPath = path.join(currentDir, "node_modules");
      const packageJsonPath = path.join(currentDir, "package.json");

      if (fs.existsSync(nodeModulesPath) && fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            await fs.promises.readFile(packageJsonPath, "utf8"),
          );
          // Check if this looks like our monorepo root
          if (
            packageJson.name === "rw-sdk-monorepo" ||
            packageJson.private === true
          ) {
            monorepoRoot = currentDir;
            break;
          }
        } catch {
          // Continue searching if we can't read the package.json
        }
      }
      currentDir = path.dirname(currentDir);
    }

    if (!monorepoRoot) {
      log(`  ⚠️ Could not find monorepo root, skipping wrangler cache copy`);
      return;
    }

    const sourceCachePath = path.join(
      monorepoRoot,
      "node_modules/.cache/wrangler",
    );
    const targetCachePath = path.join(
      targetDir,
      "node_modules/.cache/wrangler",
    );

    if (fs.existsSync(sourceCachePath)) {
      log(`  🔐 Copying wrangler cache from monorepo to temp directory...`);

      // Ensure the target cache directory exists
      await fs.promises.mkdir(path.dirname(targetCachePath), {
        recursive: true,
      });

      // Copy the entire wrangler cache directory
      await $`cp -r ${sourceCachePath} ${path.dirname(targetCachePath)}`;

      log(`  ✅ Wrangler cache copied successfully`);
    } else {
      log(
        `  ⚠️ No wrangler cache found in monorepo, deployment tests may require authentication`,
      );
    }
  } catch (error) {
    log(`  ⚠️ Failed to copy wrangler cache: ${(error as Error).message}`);
    // Don't throw - this is not a fatal error, deployment tests will just need manual auth
  }
}

/**
 * Creates a tarball-based test environment similar to the release script approach
 */
export async function setupTarballEnvironment({
  projectDir,
  packageManager = "pnpm",
}: SetupTarballOptions): Promise<TarballEnvironment> {
  log(`🚀 Setting up tarball environment for ${projectDir}`);

  // Generate a resource unique key for this test run
  const uniqueNameSuffix = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: "-",
    length: 2,
    style: "lowerCase",
  });

  // Create a short unique hash based on the timestamp
  const hash = createHash("md5")
    .update(Date.now().toString())
    .digest("hex")
    .substring(0, 8);

  const resourceUniqueKey = `${uniqueNameSuffix}-${hash}`;

  try {
    const { tempDir, targetDir } = await copyProjectToTempDir(
      projectDir,
      resourceUniqueKey,
      packageManager,
    );

    // Verify installation
    const sdkPackageJson = JSON.parse(
      await fs.promises.readFile(
        path.join(targetDir, "node_modules/rwsdk/package.json"),
        "utf8",
      ),
    );
    log(`✅ Installed rwsdk version: ${sdkPackageJson.version}`);

    // Copy wrangler cache to improve deployment performance
    const sdkRoot = ROOT_DIR;
    await copyWranglerCache(targetDir, sdkRoot);

    log(`✅ Tarball environment setup complete`);

    return {
      targetDir,
      cleanup: async () => {
        log(`🧹 Cleaning up tarball environment: ${tempDir.path}`);
        await tempDir.cleanup();
      },
    };
  } catch (error) {
    // Cleanup tarball on error
    throw error;
  }
}
