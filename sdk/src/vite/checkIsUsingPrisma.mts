import enhancedResolve from "enhanced-resolve";

export type PrismaCheckResult = {
  isUsingPrisma: boolean;
};

export const isUsingPrisma = ({
  projectRootDir,
  resolver = enhancedResolve.sync,
}: {
  projectRootDir: string;
  resolver?: (path: string, request: string) => string | false;
}) => {
  try {
    const prismaClientPath = resolver(projectRootDir, "@prisma/client");
    if (!prismaClientPath) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const checkPrismaStatus = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): PrismaCheckResult => {
  return {
    isUsingPrisma: isUsingPrisma({ projectRootDir }),
  };
};
