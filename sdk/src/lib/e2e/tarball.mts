import { createHash } from "crypto";
import { $ } from "execa";
import fs from "node:fs";
import path from "node:path";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { ROOT_DIR } from "../constants.mjs";
import { copyProjectToTempDir } from "./environment.mjs";

const log = (message: string) => console.log(message);

interface SetupTarballOptions {
  projectDir: string;
  monorepoRoot?: string;
  packageManager?: "pnpm" | "npm" | "yarn" | "yarn-classic";
}

interface TarballEnvironment {
  targetDir: string;
  cleanup: () => Promise<void>;
}

async function verifyPackedContents(targetDir: string) {
  log("  - Verifying installed package contents...");
  const packageName = "rwsdk";
  const installedDistPath = path.join(
    targetDir,
    "node_modules",
    packageName,
    "dist",
  );

  if (!fs.existsSync(installedDistPath)) {
    throw new Error(
      `dist/ directory not found in installed package at ${installedDistPath}.`,
    );
  }

  const { stdout: originalDistChecksumOut } = await $(
    "find . -type f | sort | md5sum",
    {
      shell: true,
      cwd: path.join(ROOT_DIR, "dist"),
    },
  );
  const originalDistChecksum = originalDistChecksumOut.split(" ")[0];

  const { stdout: installedDistChecksumOut } = await $(
    "find . -type f | sort | md5sum",
    {
      shell: true,
      cwd: installedDistPath,
    },
  );
  const installedDistChecksum = installedDistChecksumOut.split(" ")[0];

  log(`    - Original dist checksum: ${originalDistChecksum}`);
  log(`    - Installed dist checksum: ${installedDistChecksum}`);

  if (originalDistChecksum !== installedDistChecksum) {
    throw new Error(
      "File list in installed dist/ does not match original dist/.",
    );
  }

  log("  ✅ Installed package contents match the local build.");
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
  monorepoRoot,
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
      monorepoRoot,
    );

    await verifyPackedContents(targetDir);

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
