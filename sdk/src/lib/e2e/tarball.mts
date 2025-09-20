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
  tempDir: string;
  tarballPath: string;
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
  const tempDir = path.join(os.tmpdir(), tempDirName);
  const targetDir = path.join(tempDir, projectName);

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

    // Get current working directory (should be SDK root)
    const sdkRoot = process.cwd();

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
      await $({ cwd: targetDir })`npm install ${tarballPath}`;
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

    // Cleanup function
    const cleanup = async () => {
      try {
        // Remove tarball
        if (fs.existsSync(tarballPath)) {
          await fs.promises.unlink(tarballPath);
        }
        // Remove temp directory
        if (fs.existsSync(tempDir)) {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
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
      tempDir,
      tarballPath,
    };
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.warn(
        `Warning: Failed to cleanup after error: ${(cleanupError as Error).message}`,
      );
    }
    throw error;
  }
}
