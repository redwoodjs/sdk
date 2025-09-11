# Windows Path Fixes - 2025-09-11

## Problem
Different places in rwsdk fail on Windows due to module path issues. Two main error patterns:

1. **ESM URL Scheme Error**: Node.js ESM loader rejects Windows absolute paths that aren't proper file:// URLs
   - Error: `Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'c:'`

2. **Path Duplication Error**: Directory creation fails due to duplicated drive letters
   - Error: `ENOENT: no such file or directory, mkdir 'C:\C:\Users\...'`
   - Occurs in `directiveModulesDevPlugin.mjs:63:13`

## Plan
1. Modify GitHub workflow to run Windows smoke tests (currently skipped)
2. Use GitHub CLI to check results and logs
3. Identify specific locations where path handling fails
4. Fix path normalization issues across the codebase
5. Test fixes with Windows smoke tests

## Context
- Working on `windows` branch
- Need to handle Windows absolute paths properly for Node.js ESM
- Path construction logic appears to be duplicating drive letters

## Investigation Log

### Windows Smoke Tests Results
Successfully enabled Windows smoke tests and identified the exact issue:

**Error**: `ENOENT: no such file or directory, mkdir 'C:\C:\Users\...'`
- Path shows duplicated drive letter: `C:\C:\`
- Occurs in `directiveModulesDevPlugin.mjs:63:13` during `mkdirSync`
- Affects `__intermediate_builds` directory creation

**Root Cause**: Path construction logic is duplicating the Windows drive letter when building absolute paths.

### Progress Update
- **Fixed**: Path duplication issue in `constants.mts`
- Used `fileURLToPath()` instead of `.pathname`
- Directory creation now works: `C:\C:\Users\...` → `C:\Users\...`

🔍 **New Issue**: ESM URL scheme error in `runDirectivesScan.mjs:205`
- Error: `Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'c:'`
- Need to convert Windows absolute paths to proper `file://` URLs for Node.js ESM loader

### Attempt 1: Convert paths to file:// URLs in esbuild
❌ **Failed**: Added `pathToFileURL()` conversion in `onResolve` and `fileURLToPath()` in `readFileWithCache`
- The error still occurs, suggesting the issue might be elsewhere or the approach isn't working
- The scan completes ("✅ Scan complete.") but then fails with the same ESM error
- This indicates the error might be happening in a different part of the process
