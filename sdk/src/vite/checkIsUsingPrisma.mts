import enhancedResolve from "enhanced-resolve";
import { pathExists } from "fs-extra";
import { resolve } from "path";

export type PrismaCheckResult = {
  isUsingPrisma: boolean;
  hasNodeModulesGeneratedPrismaClient: boolean;
};

const isUsingPrisma = ({ projectRootDir }: { projectRootDir: string }) => {
  try {
    const prismaClientPath = enhancedResolve.sync(
      projectRootDir,
      "@prisma/client",
    );
    if (!prismaClientPath) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const hasNodeModulesGeneratedPrismaClient = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  try {
    return pathExists(
      resolve(projectRootDir, "node_modules", ".prisma", "client"),
    );
  } catch {
    return false;
  }
};

export const checkPrismaStatus = async ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Promise<PrismaCheckResult> => {
  return {
    isUsingPrisma: isUsingPrisma({ projectRootDir }),
    hasNodeModulesGeneratedPrismaClient:
      await hasNodeModulesGeneratedPrismaClient({
        projectRootDir,
      }),
  };
};
