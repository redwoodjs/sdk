import { $ } from "execa";
import { ROOT_DIR } from "./constants.mjs";

export const findFilesContainingUseClient = async () => {
  const result = await $({
    cwd: ROOT_DIR,
    // context(justinvdm, 2024-12-05): Empty grep results will cause non-zero exit code
    reject: false,
  })`grep -rl --include=*.ts --include=*.tsx -e ${'"use client"'} -e ${"'use client'"} ./src/app`;

  return result.stdout
    .split("\n")
    .map((line) => line.trim().slice(1))
    .filter(Boolean);
};
