import type { Plugin } from "vite";
import path from "path";
import { ensureAliasArray } from "./ensureAliasArray.mjs";

export const prismaPlugin = ({
  projectRootDir,
}: {
  projectRootDir: string;
}): Plugin => {
  return {
    name: "rwsdk:prisma",
    //configEnvironment(name, config) {
    //  if (name !== "worker") {
    //    return;
    //  }

    //  config.optimizeDeps ??= {};
    //  config.optimizeDeps.include ??= [];
    //  config.optimizeDeps.include.push("@generated/prisma");

    //  ensureAliasArray(config).push({
    //    find: /^@generated\/prisma$/,
    //    replacement: path.join(
    //      projectRootDir,
    //      "generated",
    //      "prisma",
    //      "index.js",
    //    ),
    //  });
    //},
  };
};
