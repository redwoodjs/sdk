import { resolve } from "node:path";
import snakeCase from "lodash/snakeCase.js";
import { remove } from "fs-extra";

export const invalidateViteDepsCacheEntry = async ({
  projectRootDir,
  environment,
  entry,
}: {
  projectRootDir: string;
  environment: "client" | "worker";
  entry: string;
}) => {
  const suffix = environment === "worker" ? "_worker" : "";
  const viteDepsCachePath = resolve(
    projectRootDir,
    "node_modules",
    ".vite",
    `deps${suffix}`,
    `${snakeCase(entry)}.js`,
  );
  await remove(viteDepsCachePath);
  await remove(`${viteDepsCachePath}.map`);
};
