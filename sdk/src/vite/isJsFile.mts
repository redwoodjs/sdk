export function isJsFile(filepath: string) {
  return /\.(m|c)?(j|t)s(x)?$/.test(filepath);
}
