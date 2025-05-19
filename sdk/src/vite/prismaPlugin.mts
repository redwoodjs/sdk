import type { EnvironmentOptions } from "vite";
import type { Plugin } from "vite";
import enhancedResolve from "enhanced-resolve";
import path from "path";

const resolvePrismaDep = enhancedResolve.create.sync({
  extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  mainFields: ["module", "main"],
  conditionNames: ["workerd"],
});

export const prismaPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:prisma",
    configEnvironment(name: string, config: EnvironmentOptions) {
      if (name !== "worker") {
        return;
      }

      (config.optimizeDeps ??= {}).include = ["@prisma/client"];

      // context(justinvdm, 19 May 2025): EnvironmentOptions does not have resolve.alias in type, but
      // we need it for optimizeDeps to see the alias
      (config.resolve as any).alias = {
        "@prisma/client": path.join(
          projectRootDir,
          "node_modules",
          ".prisma",
          "client",
          "edge.js",
        ),
      };
    },
  };
};
