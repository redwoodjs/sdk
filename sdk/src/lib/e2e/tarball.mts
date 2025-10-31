import { createHash } from "crypto";
import { $ } from "execa";
import fs from "node:fs";
import path from "node:path";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { INTERMEDIATES_OUTPUT_DIR, ROOT_DIR } from "../constants.mjs";
import {
  copyProjectToTempDir,
  getFilesRecursively,
} from "./environment.mjs";

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

async function getFileChecksums(
  directory: string,
): Promise<Map<string, string>> {
  const checksums = new Map<string, string>();
  if (!fs.existsSync(directory)) {
    return checksums;
  }
  const files = await getFilesRecursively(directory);

  for (const file of files) {
    const relativePath = path.relative(directory, file).replace(/\\/g, "/"); // Normalize
    const data = await fs.promises.readFile(file);
    const hash = createHash("md5").update(data).digest("hex");
    checksums.set(relativePath, hash);
  }
  return checksums;
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

  const originalFiles = await getFileChecksums(path.join(ROOT_DIR, "dist"));
  const installedFiles = await getFileChecksums(installedDistPath);

  const intermediatesDirName = path.basename(INTERMEDIATES_OUTPUT_DIR);

  const filterIntermediates = (p: string) =>
    !p.startsWith(intermediatesDirName + "/");

  const originalFilePaths = new Set(
    [...originalFiles.keys()].filter(filterIntermediates),
  );
  const installedFilePaths = new Set(
    [...installedFiles.keys()].filter(filterIntermediates),
  );

  let mismatchFound = false;

  log(`    - Comparing ${originalFilePaths.size} original files with ${installedFilePaths.size} installed files...`);

  // Find files in original but not in installed
  for (const filePath of originalFilePaths) {
    if (!installedFilePaths.has(filePath)) {
      log(`    - MISSING FILE in installed dist: ${filePath}`);
      mismatchFound = true;
    }
  }

  // Find files in installed but not in original
  for (const filePath of installedFilePaths) {
    if (!originalFilePaths.has(filePath)) {
      log(`    - EXTRA FILE in installed dist: ${filePath}`);
      mismatchFound = true;
    }
  }

  // Compare checksums for common files
  for (const filePath of originalFilePaths) {
    if (installedFilePaths.has(filePath)) {
      const originalChecksum = originalFiles.get(filePath);
      const installedChecksum = installedFiles.get(filePath);
      if (originalChecksum !== installedChecksum) {
        log(`    - CHECKSUM MISMATCH for ${filePath}:`);
        log(`      - Original:  ${originalChecksum}`);
        log(`      - Installed: ${installedChecksum}`);
        mismatchFound = true;
      }
    }
  }

  if (mismatchFound) {
    throw new Error(
      "Mismatch found between original and installed dist directories.",
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
