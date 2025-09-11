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
Starting investigation...
