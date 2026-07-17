import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playgroundDir = path.resolve(__dirname, "..");
const packagesDir = path.join(playgroundDir, "packages");
const nodeModulesDir = path.join(playgroundDir, "node_modules");

async function main() {
  const packageDirs = await fs.promises.readdir(packagesDir, {
    withFileTypes: true,
  });

  const packages = packageDirs
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (packages.length === 0) {
    console.log("No local packages found");
    return;
  }

  console.log(`Installing local packages: ${packages.join(", ")}`);

  await fs.promises.mkdir(nodeModulesDir, { recursive: true });

  for (const packageName of packages) {
    const packageDir = path.join(packagesDir, packageName);
    const targetDir = path.join(nodeModulesDir, packageName);

    const tarballName = execSync(
      `npm pack --pack-destination=${packageDir}`,
      { cwd: packageDir, encoding: "utf-8", stdio: "pipe" },
    ).trim();

    if (!tarballName) {
      throw new Error(`Failed to pack package ${packageName}`);
    }

    const tarballPath = path.join(packageDir, tarballName);
    console.log(`  Packed ${packageName} -> ${tarballName}`);

    await fs.promises.rm(targetDir, { recursive: true, force: true });
    await fs.promises.mkdir(targetDir, { recursive: true });

    execSync(`tar -xzf ${tarballPath} -C ${targetDir} --strip-components=1`, {
      stdio: "pipe",
    });

    console.log(`  Installed ${packageName} to ${targetDir}`);
  }

  console.log(`Installed ${packages.length} local packages`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
