import { $ } from "execa";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const log = (message: string) => console.log(message);

interface SetupTarballOptions {
  projectDir: string;
  packageManager?: "pnpm" | "npm" | "yarn";
}

interface TarballEnvironment {
  targetDir: string;
  cleanup: () => Promise<void>;
  tarballPath: string;
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
  // Generate unique temp directory name
  const randomId = crypto.randomBytes(4).toString("hex");
  const projectName = path.basename(projectDir);
  const tempDirName = `${projectName}-e2e-test-${randomId}`;
  const targetDir = path.join(os.tmpdir(), tempDirName);

  log(`📁 Creating temp directory: ${targetDir}`);

  // Create temp directory
  await fs.promises.mkdir(targetDir, { recursive: true });

  try {
    // Copy project to temp directory
    log(`📋 Copying project from ${projectDir} to ${targetDir}`);
    await $`cp -a ${projectDir}/. ${targetDir}/`;

    // Configure temp project to not use frozen lockfile
    log(`⚙️  Configuring temp project to not use frozen lockfile...`);
    const npmrcPath = path.join(targetDir, ".npmrc");
    await fs.promises.writeFile(npmrcPath, "frozen-lockfile=false\n");

    // Replace workspace:* dependencies with placeholder versions
    log(`🔄 Replacing workspace dependencies...`);
    const packageJsonPath = path.join(targetDir, "package.json");
    const packageJsonContent = await fs.promises.readFile(
      packageJsonPath,
      "utf8",
    );
    const packageJson = JSON.parse(packageJsonContent);

    // Replace workspace:* dependencies with a placeholder version
    const replaceWorkspaceDeps = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (version === "workspace:*") {
          deps[name] = "0.0.80"; // Use a placeholder version that exists on npm
        }
      }
    };

    replaceWorkspaceDeps(packageJson.dependencies);
    replaceWorkspaceDeps(packageJson.devDependencies);
    replaceWorkspaceDeps(packageJson.peerDependencies);

    await fs.promises.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
    );

    // Find SDK root directory (relative to current working directory)
    const currentDir = process.cwd();
    const sdkRoot = currentDir.includes("/playground")
      ? path.join(currentDir, "../sdk")
      : currentDir;

    // Pack the SDK
    log(`📦 Packing SDK from ${sdkRoot}...`);
    const packResult = await $({ cwd: sdkRoot })`npm pack`;
    const tarballName = packResult.stdout.trim();
    const tarballPath = path.join(sdkRoot, tarballName);

    // Install the tarball in the temp project
    log(`💿 Installing tarball ${tarballName} in ${targetDir}...`);

    if (packageManager === "pnpm") {
      await $({ cwd: targetDir })`pnpm add ${tarballPath}`;
    } else if (packageManager === "npm") {
      // Remove any existing lock files to ensure clean npm installation
      await $({
        cwd: targetDir,
      })`rm -f pnpm-lock.yaml yarn.lock package-lock.json`;
      // Remove existing node_modules to ensure clean installation
      await $({ cwd: targetDir })`rm -rf node_modules`;
      // Install all dependencies from package.json, which includes the rwsdk tarball
      await $({ cwd: targetDir })`npm install`;
    } else if (packageManager === "yarn") {
      await $({ cwd: targetDir })`yarn add ${tarballPath}`;
    } else {
      throw new Error(`Unsupported package manager: ${packageManager}`);
    }

    // Verify installation
    const sdkPackageJson = JSON.parse(
      await fs.promises.readFile(path.join(sdkRoot, "package.json"), "utf8"),
    );
    const packageName = sdkPackageJson.name;
    const installedDistPath = path.join(
      targetDir,
      "node_modules",
      packageName,
      "dist",
    );

    log(`🔍 Verifying installed package contents...`);
    if (!fs.existsSync(installedDistPath)) {
      throw new Error(
        `dist/ directory not found in installed package at ${installedDistPath}`,
      );
    }

    // Compare checksums like the release script does
    const originalDistPath = path.join(sdkRoot, "dist");
    if (fs.existsSync(originalDistPath)) {
      const getDistChecksum = async (distPath: string) => {
        const findResult = await $({ cwd: distPath })`find . -type f`;
        const sortedFiles = findResult.stdout
          .trim()
          .split("\n")
          .sort()
          .join("\n");
        return crypto.createHash("md5").update(sortedFiles).digest("hex");
      };

      const originalChecksum = await getDistChecksum(originalDistPath);
      const installedChecksum = await getDistChecksum(installedDistPath);

      log(`  - Original dist checksum: ${originalChecksum}`);
      log(`  - Installed dist checksum: ${installedChecksum}`);

      if (originalChecksum !== installedChecksum) {
        throw new Error(
          "File list in installed dist/ does not match original dist/",
        );
      }
      log(`  ✅ Installed package contents match the local build`);
    }

    // Copy wrangler cache from monorepo to temp directory for deployment tests
    await copyWranglerCache(targetDir, sdkRoot);

    // Cleanup function
    const cleanup = async () => {
      try {
        // Remove tarball
        if (fs.existsSync(tarballPath)) {
          await fs.promises.unlink(tarballPath);
        }
        // Remove temp directory
        if (fs.existsSync(targetDir)) {
          await fs.promises.rm(targetDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(
          `Warning: Failed to cleanup temp files: ${(error as Error).message}`,
        );
      }
    };

    return {
      targetDir,
      cleanup,
      tarballPath,
    };
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(targetDir)) {
        await fs.promises.rm(targetDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn(
        `Warning: Failed to cleanup after error: ${(cleanupError as Error).message}`,
      );
    }
    throw error;
  }
}
