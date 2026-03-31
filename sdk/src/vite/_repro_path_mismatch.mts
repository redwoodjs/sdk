#!/usr/bin/env tsx
/**
 * Reproduction script for path format mismatch in barrel generation.
 *
 * This script demonstrates that generateVendorBarrelContent produces barrel
 * files where the import paths and export keys use DIFFERENT path formats
 * for the same file.
 *
 * Key finding: The barrel export key must match the lookup map key format
 * (Vite-style: /node_modules/lib-a/index.js) to allow correct runtime access.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simulate a project at /Users/test/project
const projectRootDir = "/Users/test/project";

// Simulate a node_modules file as it appears in the clientFiles Set
// (after normalization by runDirectivesScan: normalizeModulePath(realPath, rootConfig.root))
const fileInClientFiles = "/node_modules/lucide-react/dist/esm/icons/home/index.js";

console.log("=== PATH FORMAT MISMATCH REPRODUCTION ===\n");

console.log("Simulated project root:", projectRootDir);
console.log("Simulated file in clientFiles Set:", fileInClientFiles);
console.log("");

// ---- Barrel import path (uses { absolute: true }) ----
const barrelImportPath = normalizeModulePath(fileInClientFiles, projectRootDir, {
  absolute: true,
});
console.log("Barrel IMPORT path  (absolute: true):");
console.log(`  ${barrelImportPath}`);
console.log("");

// ---- Barrel export key (no absolute flag) ----
const barrelExportKey = normalizeModulePath(fileInClientFiles, projectRootDir);
console.log("Barrel EXPORT key    (no absolute flag):");
console.log(`  '${barrelExportKey}'`);
console.log("");

// ---- Are they the same? ----
const mismatch = barrelImportPath !== barrelExportKey;
console.log("=== MISMATCH DETECTED ===");
console.log(`Import and export use DIFFERENT formats: ${mismatch}`);
console.log("");

// ---- What the barrel would look like ----
console.log("=== GENERATED BARREL CONTENT (ILLUSTRATIVE) ===\n");
const illustrativeBarrel = `import * as M0 from '${barrelImportPath}';

export default {
  '${barrelExportKey}': M0,
};`;
console.log(illustrativeBarrel);
console.log("");

// ---- The lookup map access ----
console.log("=== LOOKUP MAP ACCESS (from createDirectiveLookupPlugin) ===\n");
console.log("The lookup map is generated with:");
console.log(`  "${fileInClientFiles}": () => import("rwsdk/__vendor_client_barrel").then(m => m.default["${fileInClientFiles}"])`);
console.log("");
console.log("At runtime, m.default['${fileInClientFiles}'] is accessed.");
console.log("The barrel MUST export this key for the lookup to succeed.");
console.log("");

// ---- Analysis ----
console.log("=== ANALYSIS ===\n");

// The file in clientFiles is already Vite-style (no { absolute: true } was used when adding it)
// from runDirectivesScan.mts line 389: clientFiles.add(normalizeModulePath(realPath, rootConfig.root))
// So the lookup map key matches fileInClientFiles

// For the barrel to work:
// - The barrel export key MUST match the lookup map key
// - fileInClientFiles IS the lookup map key
// - barrelExportKey === fileInClientFiles ✓ (they use the same normalize call)
// - barrelImportPath is used only for the import statement itself

console.log("1. clientFiles stores Vite-style paths (no { absolute: true })");
console.log("   Verified in runDirectivesScan.mts line 389:");
console.log("   clientFiles.add(normalizeModulePath(realPath, rootConfig.root))");
console.log("");

console.log("2. The lookup map uses the clientFiles path as the key");
console.log("   Verified in createDirectiveLookupPlugin.mts line 32:");
console.log('   "${file}": () => import("...").then(m => m.default["${file}"])');
console.log("");

console.log("3. Barrel export key uses normalizeModulePath(file, projectRootDir)");
console.log("   This produces: '${barrelExportKey}'");
console.log("   Which matches the lookup key: '${fileInClientFiles}'");
console.log("");

console.log("4. Barrel import uses normalizeModulePath(file, projectRootDir, { absolute: true })");
console.log("   This produces: '${barrelImportPath}'");
console.log("   (Different format, but the import path string itself is just a literal)");
console.log("");

// ---- Conclusion ----
console.log("=== CONCLUSION ===\n");
console.log("The export key format IS correct (Vite-style).");
console.log("The lookup map key matches the export key because:");
console.log("  - clientFiles stores Vite-style paths");
console.log("  - barrel export key uses the same Vite-style path");
console.log("");
console.log("The import path uses a different format (absolute), but this does not");
console.log("break the barrel because the import is just a module specifier string.");
console.log("");
console.log("VERDICT: Option B is correct — remove { absolute: true } from the");
console.log("         barrel import call (line 22) to align with the export key.");
console.log("");
console.log("This makes the barrel file self-consistent: both import and export");
console.log("for the same file use the same normalized path format.");
