import { resolve } from "node:path";
import { readFile } from "fs/promises";
import { parse as parseToml } from "toml";
import { ROOT_DIR } from "./constants.mjs";

export const readWranglerConfig = async () => {
  return parseToml(await readFile(resolve(ROOT_DIR, "wrangler.toml"), "utf8"));
};
