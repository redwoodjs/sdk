import enhancedResolve from "enhanced-resolve";

export type PrismaCheckResult = {
  isUsingPrisma: boolean;
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
      return { isUsingPrisma: false };
    }
    return { isUsingPrisma: true };
  } catch {
    return { isUsingPrisma: false };
  }
};

export const checkIsUsingPrisma = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  return checkPrismaStatus({ projectRootDir }).isUsingPrisma;
};
