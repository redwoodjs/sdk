import { config } from "dotenv";
import { resolve } from "node:path";
import { ROOT_DIR } from "./constants.mjs";

export const dotenv =
  config({
    path: resolve(ROOT_DIR, ".env"),
  }).parsed ?? {};
