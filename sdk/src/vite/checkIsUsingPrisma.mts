import enhancedResolve from "enhanced-resolve";

export type PrismaCheckResult = {
  isUsingPrisma: boolean;
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

export const checkPrismaStatus = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): PrismaCheckResult => {
  return {
    isUsingPrisma: isUsingPrisma({ projectRootDir }),
  };
};
