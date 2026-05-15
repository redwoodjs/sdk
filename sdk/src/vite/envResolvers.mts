import enhancedResolve from "enhanced-resolve";

export const ENV_RESOLVERS = {
  ssr: enhancedResolve.create.sync({
    conditionNames: ["workerd", "worker", "edge", "default"],
  }),

  worker: enhancedResolve.create.sync({
    conditionNames: ["react-server", "workerd", "worker", "edge", "default"],
  }),

  client: enhancedResolve.create.sync({
    conditionNames: ["browser", "default"],
  }),
};

export const maybeResolveEnvImport = ({
  id,
  envName,
  projectRootDir,
}: {
  id: string;
  envName: keyof typeof ENV_RESOLVERS;
  projectRootDir: string;
}) => {
  try {
    return ENV_RESOLVERS[envName](projectRootDir, id) || undefined;
  } catch (error) {
    return undefined;
  }
};
