export function stripBase(path: string, base: string): string {
  return base && base !== "/" && path.startsWith(base)
    ? "/" + path.slice(base.length)
    : path;
}
