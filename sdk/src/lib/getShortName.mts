import { relative } from "node:path";

export const getShortName = (file: string, root: string): string =>
  file.startsWith(root) ? relative(root, file) : file;
