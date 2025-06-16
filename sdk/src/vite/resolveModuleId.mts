import { normalizeModulePath } from "./normalizeModulePath.mjs";

/**
 * Resolves a module ID consistently across client and server transformations.
 * For node modules, uses the /rwsdk:kind/relativePath format.
 * For regular files, uses the raw ID.
 */
export function resolveModuleId(
  id: string,
  kind: "client" | "server",
  projectRootDir: string,
): string {
  if (id.startsWith("/rwsdk:")) {
    return id;
  }

  const modulePath = normalizeModulePath(projectRootDir, id);

  return modulePath.includes("node_modules")
    ? `/rwsdk:${kind}${modulePath}`
    : modulePath;
}
