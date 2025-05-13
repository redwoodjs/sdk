import enhancedResolve from "enhanced-resolve";
import fs from "node:fs";
import path from "node:path";
import semver from "semver";

export type PrismaCheckResult = {
  isUsingPrisma: boolean;
  requiresWasmSupport: boolean;
};

export const checkPrismaStatus = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): PrismaCheckResult => {
  try {
    const prismaClientPath = enhancedResolve.sync(
      projectRootDir,
      "@prisma/client",
    );
    if (!prismaClientPath) {
      return { isUsingPrisma: false, requiresWasmSupport: false };
    }

    // Check Prisma version
    const prismaPackageJsonPath = path.join(
      path.dirname(prismaClientPath),
      "package.json",
    );
    if (fs.existsSync(prismaPackageJsonPath)) {
      const packageJson = JSON.parse(
        fs.readFileSync(prismaPackageJsonPath, "utf-8"),
      );
      const prismaVersion = packageJson.version;

      // If version is less than 6.7.0, we need WASM support
      const requiresWasmSupport = !semver.gte(prismaVersion, "6.7.0");

      return { isUsingPrisma: true, requiresWasmSupport };
    }

    // If we can't determine version, assume we need WASM support
    return { isUsingPrisma: true, requiresWasmSupport: true };
  } catch {
    return { isUsingPrisma: false, requiresWasmSupport: false };
  }
};

// Keep backward compatibility
export const checkIsUsingPrisma = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  return checkPrismaStatus({ projectRootDir }).isUsingPrisma;
};
