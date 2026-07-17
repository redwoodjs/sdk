import { execSync } from "node:child_process";
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
   * The names of the packages to install. If not provided, all packages
   * in `packagesDir` will be installed.
   */
  packageNames?: string[];
}

/**
 * Packs local packages into tarballs and extracts them into the target
 * directory's `node_modules`. This is useful for playground tests that need
 * to install local packages as regular dependencies (so they get prebundled by
 * Vite) without including them in the project's `package.json` dependencies
 * (which would cause lockfile issues in CI).
 *
 * We avoid the package manager's install command (e.g. `pnpm add`) because it
 * can deadlock when run inside a `postinstall` script (the parent package
 * manager install holds locks on the store/lockfile) or hang when modifying a
 * lockfile inside a read-only E2E cache.
 */
export async function installLocalPackages({
  packagesDir,
  targetDir,
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

  const nodeModulesDir = path.join(targetDir, "node_modules");
  await fs.promises.mkdir(nodeModulesDir, { recursive: true });

  for (const packageName of packagesToInstall) {
    const packageDir = path.join(packagesDir, packageName);
    const targetPackageDir = path.join(nodeModulesDir, packageName);

    const tarballName = execSync(
      `npm pack --pack-destination=${packageDir}`,
      { cwd: packageDir, encoding: "utf-8", stdio: "pipe" },
    ).trim();

    if (!tarballName) {
      throw new Error(`Failed to pack package ${packageName}`);
    }

    const tarballPath = path.join(packageDir, tarballName);
    log(`  Packed ${packageName} -> ${tarballName}`);

    await fs.promises.rm(targetPackageDir, { recursive: true, force: true });
    await fs.promises.mkdir(targetPackageDir, { recursive: true });

    execSync(`tar -xzf ${tarballPath} -C ${targetPackageDir} --strip-components=1`, {
      stdio: "pipe",
    });

    log(`  Installed ${packageName} -> ${targetPackageDir}`);
  }

  log(`Installed ${packagesToInstall.length} local packages`);
}
