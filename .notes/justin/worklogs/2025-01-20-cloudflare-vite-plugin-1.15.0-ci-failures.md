# Cloudflare Vite Plugin 1.15.0 - Additional CI Failures

## Problem

After merging fixes for the initial dev server hang and React version mismatch issues with `@cloudflare/vite-plugin@1.15.0`, CI tests revealed additional incompatibilities that were not present in the original test environment (which used an older version of the Cloudflare plugin).

## Issue 1: BaseUI Playground - Module Runner Initialization Error

### Error

```
TypeError: Cannot read properties of undefined (reading 'set')
    at CustomModuleRunner.cachedModule (workers/runner-worker.js:1238:20)
    at request (workers/runner-worker.js:1156:83)
    at null.<anonymous> (/index.tsx/virtual:rwsdk:ssr:/src/app/components/ExampleAccordion/index.tsx:5:1)
    at Object.runInlinedModule (workers/runner-worker.js:1339:4)
    at CustomModuleRunner.directRequest (workers/runner-worker.js:1210:59)
    at CustomModuleRunner.cachedRequest (workers/runner-worker.js:1117:73)
    at null.<anonymous> (/rwsdk___ssr_bridge.js?v=1237e247/virtual:rwsdk:ssr:rwsdk/__ssr_bridge:81:10)
    at null.<anonymous> (/tmp/rwsdk-e2e/e2e-projects/tmp-2467-KQ3MGB5Sg2yj/baseui-t-f4d5f974/src/app/components/ExampleAccordion/index.tsx:6:19)
    at Object.runInlinedModule (workers/runner-worker.js:1339:4)
    at CustomModuleRunner.directRequest (workers/runner-worker.js:1210:59)
```

### Context

- The error occurs during dev server startup
- Happens specifically in the BaseUI playground example
- The Cloudflare plugin is executing the worker entry file to detect exports (v1.15.0 feature)
- During this execution, SSR code (`virtual:rwsdk:ssr:`) is being evaluated
- The error is in `CustomModuleRunner.cachedModule` method at line 1238 (in the Cloudflare plugin's bundled code)
- The method is trying to call `.set()` on `this.concurrentModuleNodePromises`, which is `undefined`

### Analysis

Looking at the Cloudflare plugin's `runner-worker.js` code:

```javascript
async cachedModule(url, importer) {
  let cached = this.concurrentModuleNodePromises.get(url);
  if (cached)
    this.debug?.("[module runner] using cached module info for", url);
  else {
    let cachedModule = this.evaluatedModules.getModuleByUrl(url);
    ((cached = this.getModuleInformation(
      url,
      importer,
      cachedModule,
    ).finally(() => {
      this.concurrentModuleNodePromises.delete(url);
    })),
      this.concurrentModuleNodePromises.set(url, cached));  // <-- Line 1238 (approx)
  }
  return cached;
}
```

The error occurs because `this.concurrentModuleNodePromises` is `undefined` when `.set()` is called. This Map should be initialized in the parent `ModuleRunner` class constructor, but it appears the `CustomModuleRunner` instance is not fully initialized when SSR code executes during the export type detection phase.

### Root Cause Hypothesis

The Cloudflare plugin v1.15.0 executes the worker entry module during `configureServer` to detect exports. This execution triggers SSR code evaluation (`virtual:rwsdk:ssr:` modules) before the module runner's internal state (`concurrentModuleNodePromises` Map) is fully initialized. The module runner expects to be initialized during normal request handling, not during the early `configureServer` phase.

### Investigation Needed

1. Check when `concurrentModuleNodePromises` is initialized in the ModuleRunner base class
2. Understand the initialization sequence of `CustomModuleRunner` vs. when export type detection runs
3. Determine if this is a Cloudflare plugin bug or if we need a workaround
4. Check if SSR code execution can be deferred or if the module runner needs to be initialized earlier

### Next Steps

- Examine the Cloudflare plugin's initialization code to understand when `concurrentModuleNodePromises` should be available
- Check if there's a way to ensure the module runner is initialized before export type detection runs
- Consider if we need to prevent SSR code from executing during export type detection, or if we need to patch the Cloudflare plugin

## Issue 2: BaseUI and Mantine Playgrounds - 'react-server' Not Supported Error

### Error

```
Error: rwsdk: 'react-server' is not supported in this environment
```

### Context

- Appears in both BaseUI and Mantine playground examples
- Occurs during dev server startup
- Happens when SSR code is executed during Cloudflare plugin's export type detection
- This is the same error originally reported by the user, but now appearing in additional playgrounds

### Analysis

This error suggests that when SSR code executes during export type detection (before the module runner is fully initialized), the environment detection logic is incorrectly identifying the execution context. The code is running in a context where `react-server` condition should not be matched, but package.json exports resolution is incorrectly matching it.

### Root Cause Hypothesis

Similar to Issue 1, this is likely caused by SSR code executing during `configureServer` (for export type detection) in a context that doesn't properly represent the SSR environment. The environment detection may be relying on state that isn't initialized yet, or the execution context during export detection may be different from normal SSR execution.

### Connection to Issue 1

Both errors occur when SSR code executes during export type detection:
- Issue 1: Module runner's internal state isn't initialized
- Issue 2: Environment detection fails because execution context is incorrect

They may share the same root cause: SSR code shouldn't be executing during export type detection, or the execution context needs to be properly set up.

## Issue 3: Content Collections Race Condition (Still Present)

### Status

Still seeing this issue on the greenkeeping PR (with latest Cloudflare plugin version). This may be a side effect of SSR execution timing changes, or it may be a separate issue that needs investigation.

### Error

```
Error: RWSDK directive scan failed:
Error: Build failed with 1 error:
src/app/pages/Home.tsx:1:25: ERROR: Cannot read file ".content-collections/generated": is a directory
```

### Note

We previously implemented a fix for this by detecting when imports resolve to directories and externalizing them. However, the issue persists in CI, suggesting either:
- The fix isn't being applied correctly in CI
- There's a different code path triggering this error
- The timing changes with Cloudflare plugin 1.15.0 have exposed this in a different way

## Summary

The Cloudflare Vite plugin v1.15.0's new export type detection feature (executing worker entry during `configureServer`) is causing SSR code to execute before the module runner is fully initialized. This leads to multiple failures:

1. **Module Runner Crash**: `concurrentModuleNodePromises` is undefined when SSR code tries to use it
2. **Environment Detection Failure**: `'react-server' is not supported` error due to incorrect execution context
3. **Content Collections Race**: Still present, possibly exacerbated by timing changes

The fix will likely require either:
1. Ensuring the module runner is initialized before export type detection runs
2. Preventing SSR code from executing during export type detection
3. Patching the Cloudflare plugin to handle this case
4. Working around the issue by deferring SSR code evaluation or properly setting up the execution context

## Issue 1 Update: CSS Module Import Root Cause

### Discovery

Removing CSS module imports from BaseUI components (`ExampleAccordion`, `ExampleDialog`, `ExampleSwitch`) eliminates the error. The issue is specifically triggered by CSS module imports during SSR code evaluation.

### Evidence

From the debug logs, when the error occurs:

```
[DEBUG] finally block: this.#concurrentModuleNodePromises: Map(1) {
  '/@id/virtual:rwsdk:ssr:/src/app/components/ExampleAccordion/index.module.css' => Promise { <pending> }
}
```

The Map contains a pending promise for the CSS module (`index.module.css`). The error `Cannot read properties of undefined (reading 'set')` occurs in `CustomModuleRunner.cachedModule` at line 1949, which is the call to `stub.getFetchedModuleId(url, importer)`.

### Analysis

The error happens when:
1. A CSS module is imported in a `"use client"` component
2. The component is transformed for SSR (via `virtual:rwsdk:ssr:`)
3. During SSR evaluation, the CSS module import triggers a module load
4. The module load creates a promise that's stored in `this.#concurrentModuleNodePromises`
5. When the promise resolves (or in the `finally` block), something tries to call `.set()` on `this.#concurrentModuleNodePromises`, but `this` is undefined or wrong

### Hypothesis

The issue is related to how CSS modules are handled in the SSR bridge plugin. Looking at `ssrBridgePlugin.mts`:

1. **ID Transformation**: When a CSS module is imported via the SSR bridge, we transform the ID:
   - Original: `virtual:rwsdk:ssr:/src/app/components/ExampleAccordion/index.module.css`
   - In `resolveId`: We add `.js` suffix → `virtual:rwsdk:ssr:/src/app/components/ExampleAccordion/index.module.css.js`
   - In `load`: We strip `.js` back → `src/app/components/ExampleAccordion/index.module.css`

2. **Why the `.js` suffix**: The comment explains "It wasn't interpreted as JavaScript. It was interpreted as CSS. As if it were JavaScript. And that's why we added the extension." Without `.js`, Vite would treat it as CSS and return an empty module, but we need to process CSS modules during SSR to get the class names for hydration.

3. **The Problem**: During Cloudflare plugin's export detection, when CSS modules are processed:
   - The ID transformation (adding/stripping `.js`) might be causing the Cloudflare plugin's module runner to track the wrong module ID
   - When `fetchModule` is called with the stripped ID, the SSR environment processes it correctly, but the Cloudflare plugin's module runner might be tracking it under the `.js`-suffixed ID
   - This mismatch could cause the module runner's `#concurrentModuleNodePromises` Map to be in an inconsistent state
   - When the promise resolves or the `finally` block runs, it tries to access the Map with the wrong ID or wrong `this` context, causing `undefined`

4. **Why CSS modules specifically**: CSS modules need to be processed during SSR (unlike plain CSS files which get empty modules), so they trigger the full `fetchModule` → module runner path. The ID transformation we do might be interacting poorly with how the Cloudflare plugin tracks modules during export detection.

### Next Steps

1. Add logging to track the ID transformation flow for CSS modules during export detection
2. Check if the Cloudflare plugin's module runner is tracking modules with the `.js`-suffixed ID while we're fetching with the stripped ID
3. Investigate if we need to ensure the ID used for tracking matches the ID used for fetching
4. Consider if CSS modules should be handled differently during export detection (e.g., deferred or excluded)

## Issue 1 Update 2: Actual Root Cause - Vite CSS Plugin's `moduleCache` Not Initialized

### Discovery

After adding debugging logs, the actual error location was identified. The error is **not** in the Cloudflare plugin's module runner, but in **Vite's CSS plugin** (`vite:css`).

### Actual Error Location

```
TypeError: Cannot read properties of undefined (reading 'set')
    at TransformPluginContext.handler (vite/dist/node/chunks/config.js:30212:30)
    plugin: 'vite:css',
    id: '/Users/.../index.module.css'
```

Looking at Vite's CSS plugin code (line 30212):
```javascript
const { code: css, modules, deps, map } = await compileCSS(...);
if (modules) moduleCache.set(id, modules);  // <-- Error here
```

The `moduleCache` variable is `undefined` because it's only initialized in the plugin's `buildStart` hook (line 30162):
```javascript
buildStart() {
  moduleCache = new Map();
  cssModulesCache.set(config, moduleCache);
}
```

### Root Cause

The issue is a **timing problem**:

1. Cloudflare plugin v1.15.0 executes the worker entry during `configureServer` to detect exports
2. This triggers SSR code evaluation via the SSR bridge
3. CSS modules are processed through `fetchModule` in the SSR environment
4. Vite's CSS plugin's `transform` hook runs to process the CSS module
5. The plugin tries to call `moduleCache.set()`, but `moduleCache` is `undefined` because `buildStart` hasn't run yet

### Why `buildStart` Matters in Dev - Proof from Vite Source Code

**Proof that `configureServer` runs before `buildStart`:**

Looking at Vite's server startup code (`packages/vite/src/node/server/index.ts`):

1. **Line 904-913**: `configureServer` hooks are called during `_createServer`:
   ```typescript
   // apply configureServer hooks ------------------------------------------------
   const configureServerContext = new BasicMinimalPluginContext(...)
   const postHooks: ((() => void) | void)[] = []
   for (const hook of config.getSortedPluginHooks('configureServer')) {
     postHooks.push(await hook.call(configureServerContext, reflexServer))
   }
   ```
   This is where the Cloudflare plugin's `configureServer` runs and triggers CSS module processing.

2. **Line 986-1007**: `initServer` function is defined, which calls `buildStart`:
   ```typescript
   const initServer = async (onListen: boolean) => {
     // ...
     initingServer = (async function () {
       // For backward compatibility, we call buildStart for the client
       // environment when initing the server. For other environments
       // buildStart will be called when the first request is transformed
       await environments.client.pluginContainer.buildStart()  // Line 994
       // ...
     })()
   }
   ```

3. **Line 1009-1023**: `initServer` is called AFTER `configureServer`:
   ```typescript
   if (!middlewareMode && httpServer) {
     // initServer is called when listen() is called (line 1014)
     httpServer.listen = (async (port: number, ...args: any[]) => {
       await initServer(true)  // buildStart called here
       return listen(port, ...args)
     })
   } else {
     await initServer(false)  // Line 1022 - buildStart called here for middleware mode
   }
   ```

**Order of execution:**
1. `_createServer` starts
2. **Line 911-912**: `configureServer` hooks run ← **Cloudflare plugin runs here, triggers CSS module processing in SSR environment**
3. **Line 994**: Only `environments.client.pluginContainer.buildStart()` is called ← **Client CSS plugin initializes `moduleCache`**
4. **Line 993 comment**: "For other environments buildStart will be called when the first request is transformed"

**Critical detail:** Only the **client** environment's `buildStart` is called during server init. For **SSR** environment, `buildStart` is supposed to be called lazily when the first request is transformed (via `resolveId` at `pluginContainer.ts:368-371`).

**However, there's a bug in Vite's `buildStart` hook filtering** (`pluginContainer.ts:339-342`):
```typescript
(plugin) =>
  this.environment.name === 'client' ||
  config.server.perEnvironmentStartEndDuringDev ||
  plugin.perEnvironmentStartEndDuringDev,
```

When `resolveId` calls `buildStart()` (line 369), it calls `hookParallel` with this condition. At line 310, plugins that don't meet the condition are skipped: `if (condition && !condition(plugin)) continue`.

For SSR environment, the CSS plugin (`vite:css`) doesn't meet any of these conditions:
- `this.environment.name === 'ssr'` (not 'client')
- `config.server.perEnvironmentStartEndDuringDev` is likely false
- CSS plugin doesn't have `perEnvironmentStartEndDuringDev` flag

So the CSS plugin's `buildStart` hook is **skipped** (line 310 `continue`), meaning `moduleCache` (declared at `css.ts:297`) is never initialized because it's only set inside the plugin's `buildStart` hook (`css.ts:319`).

When the Cloudflare plugin triggers CSS module processing in the SSR environment during `configureServer`, `resolveId` does trigger `buildStart()`, but the CSS plugin's `buildStart` is filtered out, so `moduleCache` remains `undefined` when the `transform` hook tries to use it at `css.ts:436`.

**CSS Plugin Code (`packages/vite/src/node/plugins/css.ts`):**
- **Line 297**: `moduleCache` is declared but not initialized
- **Line 317-331**: `buildStart` hook initializes `moduleCache`:
  ```typescript
  buildStart() {
    moduleCache = new Map<string, Record<string, string>>()
    cssModulesCache.set(config, moduleCache)
    // ...
  }
  ```
- **Line 436**: `transform` hook uses `moduleCache`:
  ```typescript
  if (modules) {
    moduleCache.set(id, modules)  // ← Error: moduleCache is undefined
  }
  ```

**Conclusion:** `configureServer` runs before `buildStart`, so when the Cloudflare plugin triggers CSS module processing during `configureServer`, the CSS plugin's `moduleCache` is still `undefined` because `buildStart` hasn't run yet.

### Hypothesis

**This is a latent bug in Vite that has always existed.** The CSS plugin's `buildStart` hook is filtered out for SSR environment (due to the condition at `pluginContainer.ts:339-342`), meaning `moduleCache` is never initialized for SSR. The plugin doesn't check if `moduleCache` is undefined before using it at `css.ts:436`.

**Why hasn't this been hit before?**

1. **CSS modules in SSR during dev are uncommon** - Most SSR setups don't process CSS modules on the server side
2. **Normal processing happens during HTTP requests** - Even when CSS modules are processed in SSR, it happens during normal HTTP requests, not during `configureServer`
3. **Cloudflare plugin v1.15.0 is the first to trigger this** - The plugin's export detection feature executes SSR code during `configureServer`, which is the first time CSS modules are processed in SSR before normal requests begin

**The bug would actually occur even during normal requests** if CSS modules were processed in SSR, because `buildStart` is still filtered out. However, CSS modules in SSR during dev are rare enough that this hasn't been reported before.

**What changed:** Nothing in Vite changed - this bug has always existed. What changed is the Cloudflare plugin v1.15.0's behavior of executing SSR code during `configureServer`, which exposes this latent bug.

**Resolution: Shared Plugin Instance and Timing**

After adding logging and comparing behavior on `main` (old Cloudflare plugin) vs current branch (new Cloudflare plugin), the root cause was identified:

**The CSS plugin is a single shared instance across all environments.** The `moduleCache` variable (declared at `css.ts:297`) is in the plugin's closure, meaning it's **shared between client and SSR environments**. When `buildStart` runs for the **client** environment, it initializes `moduleCache`, which is then available to SSR as well.

**The timing difference:**

- **On `main` (old Cloudflare plugin)**: `initServer` runs → client `buildStart` initializes `moduleCache` → `configureServer` runs → CSS modules processed in SSR → `moduleCache` is already initialized ✅
- **On current branch (new Cloudflare plugin)**: `configureServer` runs → CSS modules processed in SSR → `initServer` hasn't run yet → `moduleCache` is still `undefined` ❌

**Why it worked before:** `initServer` (which calls `environments.client.pluginContainer.buildStart()` at line 994) happened **before** `configureServer` triggered CSS module processing. The client `buildStart` initialized the shared `moduleCache`, which SSR could then use.

**Why it breaks now:** Cloudflare plugin v1.15.0's export detection runs during `configureServer` (line 911-912), which happens **before** `initServer` (line 1022 or 1014). So CSS modules are processed before the shared `moduleCache` is initialized.

### Solution: Proactive `buildStart` Call

Since `buildStart` is idempotent (it checks `_started` and returns early if already called, or waits for an in-progress call), we can safely call it in our `configureServer` hook that runs before the Cloudflare plugin.

**Implementation:** Added `await server.environments.client.pluginContainer.buildStart()` to `knownDepsResolverPlugin`'s `configureServer` hook. This ensures the CSS plugin's shared `moduleCache` is initialized before the Cloudflare plugin triggers CSS module processing.

**Why this works:**
- `buildStart` is idempotent - safe to call multiple times
- Our `configureServer` runs before Cloudflare's (via `enforce: 'pre'`)
- Client `buildStart` initializes the shared `moduleCache` that SSR uses
- This prevents the `moduleCache.set()` error when CSS modules are processed during export detection

## PR Description

### Fix CSS module processing error during Cloudflare plugin export detection

Cloudflare Vite plugin v1.15.0 dispatches a request to the worker during `configureServer` to detect exports. This request triggers a chain of module imports: the worker entry imports components, which may import client modules (modules with `"use client"` directives), which in turn may import CSS modules. Whether this chain reaches CSS modules depends on the application, but when it does, the import chain is unavoidable because client modules are sometimes used on the server side—for example, Chakra UI and other libraries export objects or constants from client modules that are imported and used at the top level in worker code.

When CSS modules are processed during this import chain, Vite's CSS plugin attempts to cache the module information in its `moduleCache`. However, this `moduleCache` is only initialized in the client environment's [`buildStart` hook](https://github.com/vitejs/vite/blob/b1fd6161886caeb31ac646d6544116d37efe46d0/packages/vite/src/node/plugins/css.ts#L320), which normally runs during [`initServer`](https://github.com/vitejs/vite/blob/5909efd8fbfd1bf1eab65427aea0613124b2797a/packages/vite/src/node/server/index.ts#L994). Since Cloudflare's dispatch to the worker happens from within `configureServer`, which runs before `initServer`, the CSS plugin's `moduleCache` is still `undefined` when CSS modules are processed, resulting in:

```
TypeError: Cannot read properties of undefined (reading 'set')
    at vite:css transform hook
```

**Solution:**

Call `server.environments.client.pluginContainer.buildStart()` in a `configureServer` hook that runs before the Cloudflare plugin. Since `buildStart` is idempotent (it checks `_started` and returns early if already called, or waits for an in-progress call), this safely initializes the CSS plugin's shared `moduleCache` before the import chain reaches CSS modules.

**Testing:**

- BaseUI playground with CSS module imports now works correctly
- No regressions in other playgrounds
- `buildStart` is idempotent, so calling it early doesn't interfere with normal initialization

### PR Title

Fix CSS module processing error during Cloudflare plugin export detection

