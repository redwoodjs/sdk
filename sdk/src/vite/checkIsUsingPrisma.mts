import enhancedResolve from "enhanced-resolve";

export const checkIsUsingPrisma = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => {
  try {
    return Boolean(enhancedResolve.sync(projectRootDir, "@prisma/client"));
  } catch {
    return false;
  }
};
