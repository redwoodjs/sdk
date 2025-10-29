# 2025-10-29: Windows CI Fixes

## Problem

After a series of fixes to get the SDK and E2E tests running on Windows, we're now facing failures in the CI environment. The first error is a Yarn parsing error for `.yarnrc.yml` during E2E tests.

```
Usage Error: Parse error when loading /C:/Users/RUNNER~1/AppData/Local/Temp/tmp-7808-8ZrSK3rGgAdi/import-from-use-client-test-zygotic-hoverfly-e822a55e/.yarnrc.yml; please check it's proper Yaml
```

## Investigation & Fixes

### 1. Invalid YAML in `.yarnrc.yml` on Windows

**Issue:** The E2E test harness programmatically creates a `.yarnrc.yml` file to configure Yarn for the test runs. On Windows, the path to the cache folder is constructed with backslashes (e.g., `C:\...`). When this path is written into the YAML file, the backslashes are not escaped, leading to a parsing error.

**Investigation:** I inspected the code in `sdk/src/lib/e2e/environment.mts` responsible for generating this file. It uses `path.join` to create the `cacheFolder` path, which produces platform-specific separators. The resulting string is then embedded in quotes in the YAML file. The backslashes in the Windows path are being interpreted as escape sequences by Yarn's YAML parser, causing the load to fail.

**Fix:** The solution is to normalize the `cacheFolder` path to use forward slashes, which are universally accepted in YAML files, regardless of the operating system. I will modify the path string before it's written to the file.
