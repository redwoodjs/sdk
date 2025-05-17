import path from "path";
import enhancedResolve from "enhanced-resolve";
import debug from "debug";

const baseSSRResolver = enhancedResolve.create.sync({
  conditionNames: ["workerd", "edge", "import", "default"],
});

function applyAlias(request: string, aliasEntries: any, name: string): string {
  if (!aliasEntries) return request;
  const logPrefix = `[${name}]`;
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
        debug("rwsdk:vite:aliased-ssr-resolver")(
          "%s [applyAlias] Matched string alias: '%s' -> '%s' for request '%s'",
          logPrefix,
          find,
          replacement,
          request,
        );
        return replacement + request.slice(find.length);
      }
    } else if (find instanceof RegExp) {
      if (find.test(request)) {
        debug("rwsdk:vite:aliased-ssr-resolver")(
          "%s [applyAlias] Matched RegExp alias: %O -> '%s' for request '%s'",
          logPrefix,
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
  getResolveConfig,
  roots,
  name = "aliasedSSRResolver",
}: {
  getResolveConfig: () => any;
  roots: string[];
  name?: string;
}) {
  const log = debug("rwsdk:vite:aliased-ssr-resolver");
  const logPrefix = `[${name}]`;
  return function resolveModule(
    request: string,
    importer: string,
  ): string | false {
    log(
      "%s Called with request: '%s', importer: '%s'",
      logPrefix,
      request,
      importer,
    );
    let normalized = request;
    const resolveConfig = getResolveConfig?.() || {};
    const aliasEntries = resolveConfig.alias;
    log("%s Alias entries: %O", logPrefix, aliasEntries);
    normalized = applyAlias(normalized, aliasEntries, name);
    log("%s After aliasing: '%s'", logPrefix, normalized);

    let rootsToTry = roots && roots.length > 0 ? roots : [];
    // If leading slash, treat as first root-rooted (for compatibility)
    if (normalized.startsWith("/")) {
      if (rootsToTry.length > 0) {
        const rooted = path.join(rootsToTry[0], normalized);
        log(
          "%s Leading slash detected, resolving as root[0]-rooted: '%s'",
          logPrefix,
          rooted,
        );
        normalized = rooted;
        rootsToTry = [rootsToTry[0]];
      }
    }

    const isAbsolute = path.isAbsolute(normalized);

    if (isAbsolute) {
      log("%s Resolving absolute path: '%s'", logPrefix, normalized);
      return normalized;
    }

    for (const root of rootsToTry) {
      try {
        log("%s Trying root: '%s'", logPrefix, root);
        const result = baseSSRResolver(root, normalized);
        log("%s Resolved to: '%s' with root '%s'", logPrefix, result, root);
        return result;
      } catch (err) {
        log(
          "%s Resolution failed for '%s' from root '%s': %O",
          logPrefix,
          normalized,
          root,
          err,
        );
      }
    }

    return false;
  };
}
