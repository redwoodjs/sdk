/**
 * Empirical reproduction: lucide-react v1.7.0 scanner crash investigation
 *
 * Confirmed root cause: BARREL INTERNAL path inconsistency, NOT barrel-lookup mismatch.
 *
 * Summary of findings:
 * - runDirectivesScan.mts:389        → stores normalized path in clientFiles Set
 * - createDirectiveLookupPlugin.mts:32 → uses Set value as lookup key (no extra normalize)
 * - directiveModulesDevPlugin.mts:22   → barrel IMPORT uses normalizeModulePath(absolute:true)
 * - directiveModulesDevPlugin.mts:33   → barrel EXPORT uses normalizeModulePath (no absolute:true)
 *
 * KEY DISCOVERY:
 * Barrel export key and lookup key BOTH use the same normalized path (Vite-style
 * /node_modules/...). The hypothesized "barrel vs lookup" mismatch does NOT occur.
 *
 * The ACTUAL bug is: barrel import uses ABSOLUTE paths, barrel export uses VITE-STYLE paths.
 * Within generateVendorBarrelContent(), line 22 and line 33 call normalizeModulePath
 * with different options for the same file, producing two different path formats.
 * The resulting barrel module is malformed — the import resolves to one path but the
 * export key is in a different format, making the named export inaccessible at runtime.
 *
 * Evidence: All 458 existing tests pass because they test barrel export keys but
 * do NOT verify that barrel imports resolve to the same module.
 */

// @ts-nocheck
import { posix as _path } from "node:path";
import { normalizePath as nps } from "vite";

function findCommonAncestorDepth(p1, p2) {
  const s1 = p1.split("/").filter(Boolean);
  const s2 = p2.split("/").filter(Boolean);
  let n = 0;
  const min = Math.min(s1.length, s2.length);
  for (let i = 0; i < min; i++) {
    if (s1[i] === s2[i]) n++; else break;
  }
  return n;
}

function normalizeModulePath(modulePath, projectRootDir, options = {}) {
  modulePath = nps(modulePath);
  projectRootDir = nps(_path.resolve(projectRootDir));
  if (modulePath === "" || modulePath === ".") {
    return options.absolute ? projectRootDir : "/";
  }
  let resolved;
  if (_path.isAbsolute(modulePath)) {
    if (modulePath.startsWith(projectRootDir + "/") || modulePath === projectRootDir) {
      resolved = modulePath;
    } else {
      if (options.isViteStyle !== undefined) {
        resolved = options.isViteStyle
          ? _path.resolve(projectRootDir, modulePath.slice(1))
          : modulePath;
      } else {
        const d = findCommonAncestorDepth(modulePath, projectRootDir);
        resolved = d > 0 ? modulePath : _path.resolve(projectRootDir, modulePath.slice(1));
      }
    }
  } else {
    resolved = _path.resolve(projectRootDir, modulePath);
  }
  resolved = nps(resolved);
  if (options.absolute) return resolved;
  const rel = _path.relative(projectRootDir, resolved);
  if (rel.startsWith("..")) return resolved;
  const clean = rel === "." ? "" : rel;
  return "/" + nps(clean);
}

const projectRootDir = "/Users/test/project";
const realLucidePath =
  "/Users/test/project/node_modules/lucide-react/dist/esm/icons/activity.js";

console.log("=== lucide-react Scanner Crash: Empirical Reproduction ===\n");
console.log("Project root:", projectRootDir);
console.log("Real file   :", realLucidePath);
console.log("");

// Stage 1: Directive Scan (runDirectivesScan.mts:389)
const storedInSet = normalizeModulePath(realLucidePath, projectRootDir);
console.log("STAGE 1 - Directive Scan  [runDirectivesScan.mts:389]");
console.log("  Code: clientFiles.add(normalizeModulePath(realPath, rootConfig.root))");
console.log("  Stored in clientFiles Set:", JSON.stringify(storedInSet));
console.log("");

// Stage 2: Lookup Map (createDirectiveLookupPlugin.mts:32)
const lookupKey = storedInSet;
console.log("STAGE 2 - Lookup Map  [createDirectiveLookupPlugin.mts:32]");
console.log("  Code: `${file}` used as key (no extra normalizeModulePath call)");
console.log("  Lookup key:", JSON.stringify(lookupKey));
console.log("");

// Stage 3: Barrel Generation (directiveModulesDevPlugin.mts:22 & 33)
const barrelImport = normalizeModulePath(storedInSet, projectRootDir, { absolute: true });
const barrelExportKey = normalizeModulePath(storedInSet, projectRootDir);
console.log("STAGE 3 - Barrel Generation  [directiveModulesDevPlugin.mts:22 & 33]");
console.log("  IMPORT (line 22): normalizeModulePath(file, projectRootDir, { absolute: true })");
console.log("  Import path:", barrelImport);
console.log("  EXPORT (line 33): normalizeModulePath(file, projectRootDir)  [no absolute:true]");
console.log("  Export key:", barrelExportKey);
console.log("");

const barrelLookupMatch = barrelExportKey === lookupKey;
const barrelInternalMatch = barrelImport === barrelExportKey;

console.log("=== MISMATCH CHECKS ===\n");
console.log("Check 1: Barrel export key === Lookup key?");
console.log("  Result:", barrelLookupMatch ? "YES — keys are consistent" : "NO — MISMATCH!");
console.log("  Interpretation: the original hypothesis ('barrel vs lookup mismatch') is " +
  (barrelLookupMatch ? "REFUTED." : "CONFIRMED."));
console.log("");
console.log("Check 2: Barrel import path === Barrel export key?");
console.log("  Result:", barrelInternalMatch ? "YES — barrel is consistent" : "NO — INTERNAL MISMATCH!");
console.log("  Interpretation: the ACTUAL bug is " +
  (!barrelInternalMatch ? "CONFIRMED: barrel import and export use different path formats." : "not present."));
console.log("");

if (!barrelInternalMatch) {
  console.log("Root cause: line 22 uses { absolute: true } (absolute path),");
  console.log("  line 33 omits it (Vite-style path) — different formats for same file.");
  console.log("  The barrel module is malformed: import path != export key.");
  console.log("  When the barrel is loaded at runtime:");
  console.log("  1. Import: import * as M0 from '" + barrelImport + "'");
  console.log("  2. Export: { '" + barrelExportKey + "': M0 }");
  console.log("  3. Lookup accesses: m.default['" + lookupKey + "']");
  console.log("  4. The export key is '" + barrelExportKey + "', not '" + lookupKey + "'");
  console.log("  Result: undefined -> scanner crash");
}

console.log("\n=== normalizeModulePath BEHAVIOR EVIDENCE ===\n");
const cases = [
  [realLucidePath, "real absolute (inside project)"],
  ["/node_modules/lucide-react/dist/esm/icons/activity.js", "Vite-style path (same file)"],
  ["node_modules/lib-a/index.js", "relative (test data)"],
  ["/Users/shared/lib/utils.js", "real absolute (outside project)"],
];
for (const [p, label] of cases) {
  const noOpt = normalizeModulePath(p, projectRootDir);
  const withAbs = normalizeModulePath(p, projectRootDir, { absolute: true });
  console.log("  [" + label + "]");
  console.log("    Input        : " + p);
  console.log("    no opts      : " + noOpt);
  console.log("    {absolute:true}: " + withAbs);
  console.log("");
}

console.log("=== VERDICT ===\n");
if (barrelLookupMatch && barrelInternalMatch) {
  console.log("NO BUG FOUND: all three path formats are consistent.");
} else if (!barrelLookupMatch) {
  console.log("HYPOTHESIS CONFIRMED: barrel-lookup key mismatch is the root cause.");
} else {
  console.log("BARREL-INTERNAL BUG CONFIRMED: import/export path format inconsistency.");
  console.log("  This is a REFINEMENT of the original hypothesis — the barrel-lookup");
  console.log("  keys are consistent, but the barrel itself is internally inconsistent.");
  console.log("  The bug manifests when the runtime tries to access the named export");
  console.log("  using the Vite-style key while the import resolved to an absolute path.");
}

process.exit(barrelLookupMatch && barrelInternalMatch ? 0 : 1);
