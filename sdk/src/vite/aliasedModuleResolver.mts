import path from "path";
import enhancedResolve from "enhanced-resolve";
import debug from "debug";

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
        debug("rwsdk:vite:aliased-module-resolver")(
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
        debug("rwsdk:vite:aliased-module-resolver")(
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

export function createAliasedModuleResolver({
  getAliases,
  roots,
  conditionNames = ["workerd", "edge", "import", "default"],
  name = "aliasedModuleResolver",
}: {
  getAliases?: () => Array<{ find: string | RegExp; replacement: string }>;
  roots: string[];
  conditionNames?: string[];
  name?: string;
}) {
  const log = debug("rwsdk:vite:aliased-module-resolver");
  const logPrefix = `[${name}]`;
  // Create a resolver instance with the provided conditionNames
  const baseModuleResolver = enhancedResolve.create.sync({
    conditionNames,
  });
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
    const aliasEntries = getAliases ? getAliases() : [];
    log("%s Alias entries: %O", logPrefix, aliasEntries);
    const normalized = applyAlias(request, aliasEntries, name);
    log("%s After aliasing: '%s'", logPrefix, normalized);

    const result = baseModuleResolver(normalized, path.dirname(importer));

    if (result) {
      log("%s Resolved %s relative to: '%s'", logPrefix, result, importer);
      return result;
    }

    for (const root of roots) {
      try {
        const result = baseModuleResolver(root, normalized);
        log(
          "%s Resolved %s to: '%s' with root '%s'",
          logPrefix,
          normalized,
          result,
          root,
        );
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
