import path, { relative } from "node:path";

export const getShortName = (file: string, root: string): string =>
  file === root
    ? ""
    : file.startsWith(root + path.sep)
      ? relative(root, file)
      : file;
