import { relative } from "node:path";
import path from "node:path";

export const getShortName = (file: string, root: string): string =>
  file === root
    ? ""
    : file.startsWith(root + path.sep)
      ? relative(root, file)
      : file;
