import { $ } from "execa";
import fs from "node:fs";
import path from "node:path";

const log = (message: string) => console.log(message);

interface InstallLocalPackagesOptions {
  /**
   * The directory containing the local packages (e.g. `packages/`).
   */
  packagesDir: string;
  /**
   * The target directory where the packages should be installed.
   */
  targetDir: string;
  /**
   * The package manager to use for installation.
   * @default "pnpm"
   */
  packageManager?: "pnpm" | "npm" | "yarn";
  /**
   * The names of the packages to install. If not provided, all packages
   * in `packagesDir` will be installed.
   */
  packageNames?: string[];
}

/**
 * Packs local packages into tarballs and installs them into the target
 * directory. This is useful for playground tests that need to install
 * local packages as regular dependencies (so they get prebundled by Vite)
 * without including them in the project's `package.json` dependencies
 * (which would cause lockfile issues in CI).
 *
 * The packages are installed using `npm pack` followed by the package
 * manager's install command, using `file:` protocol for the tarball paths.
 */
export async function installLocalPackages({
  packagesDir,
  targetDir,
  packageManager = "pnpm",
  packageNames,
}: InstallLocalPackagesOptions): Promise<void> {
  const packageDirs = await fs.promises.readdir(packagesDir, {
    withFileTypes: true,
  });

  const packagesToInstall = packageDirs
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !packageNames || packageNames.includes(entry.name))
    .map((entry) => entry.name);

  if (packagesToInstall.length === 0) {
    log(`No local packages found in ${packagesDir}`);
    return;
  }

  log(
    `Installing local packages: ${packagesToInstall.join(", ")} from ${packagesDir}`,
  );

  const tarballPaths: string[] = [];

  for (const packageName of packagesToInstall) {
    const packageDir = path.join(packagesDir, packageName);

    // Pack the package
    const packResult = await $({
      cwd: packageDir,
      stdio: "pipe",
    })`npm pack --pack-destination=${packageDir}`;

    const tarballName = packResult.stdout?.trim();
    if (!tarballName) {
      throw new Error(`Failed to pack package ${packageName}`);
    }

    const tarballPath = path.join(packageDir, tarballName);
    tarballPaths.push(tarballPath);
    log(`  Packed ${packageName} -> ${tarballName}`);
  }

  // Install the tarballs
  const installCommand = {
    pnpm: ["pnpm", "add", ...tarballPaths],
    npm: ["npm", "install", ...tarballPaths],
    yarn: ["yarn", "add", ...tarballPaths],
  }[packageManager];

  log(`  Running ${installCommand.join(" ")}`);
  const [command, ...args] = installCommand;
  await $(command, args, {
    cwd: targetDir,
    stdio: "pipe",
  });

  log(`  Installed ${packagesToInstall.length} local packages`);
}
