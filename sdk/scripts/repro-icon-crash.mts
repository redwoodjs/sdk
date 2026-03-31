/**
 * Reproduction script: Verifies the exact key mismatch causing
 * "No module found for /node_modules/lucide-react/dist/esm/Icon.js
 *  in module lookup for use client directive"
 *
 * Hypothesis: In a pnpm monorepo, `fsp.realpath()` in runDirectivesScan.mts
 * resolves the symlink to the .pnpm store, producing a different key than
 * what the Vite transform generates when normalizing the (un-resolved) module id.
 */

import { realpath } from "node:fs/promises";
import { normalizeModulePath } from "../src/lib/normalizeModulePath.mjs";

const PROJECT_ROOT = "/home/vscode/repo/playground/directives";

// The symlink path — what enhanced-resolve returns for lucide-react Icon.js
// (enhanced-resolve with symlinks:false does NOT follow symlinks)
const SYMLINK_PATH =
  `${PROJECT_ROOT}/node_modules/lucide-react/dist/esm/Icon.js`;

// What fsp.realpath() returns — resolves pnpm symlinks
const REAL_PATH = await realpath(SYMLINK_PATH);

console.log("=== PNPM SYMLINK EVIDENCE ===");
console.log("Symlink path:", SYMLINK_PATH);
console.log("Real path:   ", REAL_PATH);
console.log("Same path?   ", SYMLINK_PATH === REAL_PATH);
console.log();

// --- KEY 1: What runDirectivesScan.mts onLoad stores in clientFiles ---
// Line ~382-389 of runDirectivesScan.mts:
//   const realPath = await fsp.realpath(args.path);
//   clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
const scanKey = normalizeModulePath(REAL_PATH, PROJECT_ROOT);
console.log("=== KEY 1: runDirectivesScan.mts stores in clientFiles ===");
console.log("normalizeModulePath(realPath, root):", scanKey);
console.log();

// --- KEY 2: What directivesPlugin.mts transform generates for ssrLoadModule ---
// Line ~80 of directivesPlugin.mts:
//   const normalizedId = normalizeModulePath(id, projectRootDir);
// Then transformClientComponents generates:
//   const SSRModule = await ssrLoadModule("${normalizedId}");
//
// For the transform, `id` is Vite's module id for Icon.js. In Vite dev mode with
// resolve.preserveSymlinks:false (default), Vite resolves symlinks. So `id` could be:
//   Option A: REAL_PATH (Vite follows symlinks → same as scan)
//   Option B: SYMLINK_PATH (Vite does NOT follow symlinks → different from scan)

const transformKeyFromSymlink = normalizeModulePath(SYMLINK_PATH, PROJECT_ROOT);
const transformKeyFromRealpath = normalizeModulePath(REAL_PATH, PROJECT_ROOT);

console.log("=== KEY 2: directivesPlugin.mts transform uses as ssrLoadModule id ===");
console.log("If Vite uses symlink path:", transformKeyFromSymlink);
console.log("If Vite uses real path:   ", transformKeyFromRealpath);
console.log();

// --- KEY 3: What dep optimizer (configEnvironment esbuild plugin) stores ---
// The dep optimizer esbuild plugin in directivesPlugin.mts uses args.path directly
// (no realpath call). What path does esbuild use during dep optimization?
// enhanced-resolve in the dep scanner returns the symlink path (symlinks:false default).
// So args.path in dep optimizer onLoad = SYMLINK_PATH
const depOptimizerKey = normalizeModulePath(SYMLINK_PATH, PROJECT_ROOT);
console.log("=== KEY 3: dep optimizer esbuild plugin uses as ssrLoadModule id ===");
console.log("normalizeModulePath(symlink_path, root):", depOptimizerKey);
console.log();

// --- MATCH ANALYSIS ---
console.log("=== MISMATCH ANALYSIS ===");
console.log(`Scan key:             "${scanKey}"`);
console.log(`Dep optimizer key:    "${depOptimizerKey}"`);
console.log();

if (scanKey === depOptimizerKey) {
  console.log("✓ MATCH between scan key and dep optimizer key");
} else {
  console.log("✗ MISMATCH between scan key and dep optimizer key");
  console.log("  → Scan stores different key than dep optimizer uses");
  console.log("  → useClientLookup[depOptimizerKey] will be undefined at runtime");
  console.log("  → ERROR: 'No module found for " + depOptimizerKey + " in module lookup for use client directive'");
}
console.log();

// Confirm the error message matches the reported one
const REPORTED_ERROR_ID = "/node_modules/lucide-react/dist/esm/Icon.js";
console.log("=== ERROR MESSAGE MATCH ===");
console.log("Reported error ID:    ", REPORTED_ERROR_ID);
console.log("Dep optimizer key:    ", depOptimizerKey);
console.log("Match?", depOptimizerKey === REPORTED_ERROR_ID);
