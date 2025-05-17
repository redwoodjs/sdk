import path from "path";
import enhancedResolve from "enhanced-resolve";
import debug from "debug";

const log = debug("rwsdk:vite:aliased-ssr-resolver");

const baseSSRResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

function applyAlias(request: string, aliasEntries: any): string {
  if (!aliasEntries) return request;
  // Support both array and object forms
  const entries = Array.isArray(aliasEntries)
    ? aliasEntries
    : Object.entries(aliasEntries).map(([find, replacement]) => ({
        find,
        replacement,
      }));
  for (const entry of entries) {
    const { find, replacement } = entry;
    if (typeof find === "string") {
      if (request === find || request.startsWith(find + "/")) {
        log(
          "[applyAlias] Matched string alias: '%s' -> '%s' for request '%s'",
          find,
          replacement,
          request,
        );
        return replacement + request.slice(find.length);
      }
    } else if (find instanceof RegExp) {
      if (find.test(request)) {
        log(
          "[applyAlias] Matched RegExp alias: %O -> '%s' for request '%s'",
          find,
          replacement,
          request,
        );
        return request.replace(find, replacement);
      }
    }
  }
  return request;
}

export function createAliasedSSRResolver({
  projectRootDir,
  getResolveConfig,
}: {
  projectRootDir: string;
  getResolveConfig: () => any;
}) {
  return function resolveModule(
    request: string,
    importer: string,
  ): string | false {
    log(
      "[resolveModule] Called with request: '%s', importer: '%s'",
      request,
      importer,
    );
    let normalized = request;
    const resolveConfig = getResolveConfig?.() || {};
    const aliasEntries = resolveConfig.alias;
    log("[resolveModule] Alias entries: %O", aliasEntries);
    normalized = applyAlias(normalized, aliasEntries);
    log("[resolveModule] After aliasing: '%s'", normalized);

    if (normalized.startsWith("/")) {
      const rooted = path.join(projectRootDir, normalized);
      log(
        "[resolveModule] Leading slash detected, resolving as projectRootDir-rooted: '%s'",
        rooted,
      );
      normalized = rooted;
    }

    try {
      const result = baseSSRResolver(path.dirname(importer), normalized);
      log("[resolveModule] Resolved to: '%s'", result);
      return result;
    } catch (err) {
      log(
        "[resolveModule] Resolution failed for '%s' from '%s': %O",
        normalized,
        importer,
        err,
      );
      return false;
    }
  };
}
