import enhancedResolve from "enhanced-resolve";

export const checkIsUsingPrisma = ({
  projectRootDir,
}: {
  projectRootDir: string;
}) => Boolean(enhancedResolve.sync(projectRootDir, "@prisma/client"));
