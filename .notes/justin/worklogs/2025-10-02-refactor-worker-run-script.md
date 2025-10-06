# 2025-10-02: Refactor `worker-run` Script

## Problem

The existing `worker-run` script is a CLI tool for executing scripts (like database seeds) within the context of a worker. Its implementation has several limitations:

1.  **Brittle Entry Point Generation**: It manually parses the project's worker entry file (`src/worker.tsx`) to find Durable Object exports. It then generates a temporary, virtual worker file that only includes these exports. This process is fragile and can easily break if the user structures their exports differently.
2.  **Isolated Vite Configuration**: The script creates its own Vite dev server instance with a hardcoded configuration. It only includes the `rwsdk` Vite plugin and ignores the user's `vite.config.mts` file entirely.
3.  **Limited User Environment**: Because the user's Vite config isn't loaded, any custom plugins, aliases, or other configurations are not available to the script being executed. This restricts what the script can do and creates a development experience that is inconsistent with the main application.

The goal was to provide a way to run scripts against Durable Objects without spinning up the entire application, but the implementation introduced unnecessary complexity and limitations.

## Proposed Solution

To address these issues, the `worker-run` script will be refactored to use the user's existing development environment instead of creating a synthetic one.

1.  **Use User's Vite Config**: The script will now load the user's `vite.config.mts` file when creating the Vite dev server. This ensures that the script runs in an environment identical to the actual development server, with all the user's plugins and configurations.
2.  **Run the Real Worker**: Instead of generating a temporary file, `worker-run` will now use the project's actual worker entry point.
3.  **Dev-Only Worker Route**: A special, dev-only route (`/__worker-run`) will be added to the `defineApp` fetch handler in `sdk/src/runtime/worker.tsx`. This route will only be active when `import.meta.env.DEV` is true.
4.  **Dynamic Script Execution**: The `worker-run` script will start the user's dev server and send a `fetch` request to the `/__worker-run` endpoint. The path to the script to be executed will be passed as a URL query parameter (e.g., `?script=./src/scripts/seed.ts`).
5.  **Dynamic Import**: The handler for the `/__worker-run` route will extract the script path from the URL, dynamically `import()` it, and execute its default export.

This new approach removes the brittle parsing logic, fully respects the user's project setup, and provides a more robust and consistent way to execute scripts.

---

### Executing Worker Scripts

**Problem**

The development server creates an isolated sandbox environment that emulates the Cloudflare Workers runtime. For tasks like database seeding, scripts need to run *inside* this sandbox to access the correct database bindings (like D1 or Durable Objects) and use the same clients (like Kysely or Prisma) as the application. The challenge was to provide a way to execute these scripts within this specific context.

**Previous Implementation**

The initial approach involved the `rwsdk worker-run` command creating a synthetic, temporary worker environment. It worked by:
1.  Parsing the user's `src/worker.tsx` file to find Durable Object exports.
2.  Generating a virtual worker file that re-exported these objects and set the target script (e.g., `seed.ts`) as the default export.
3.  Using `enhanced-resolve` to resolve the paths to these modules.
4.  Spinning up a minimal, hardcoded Vite dev server instance that used this virtual entry point.

This implementation broke down because its module resolution was too simplistic. It could not correctly handle common project configurations like tsconfig path aliases (e.g., `@/*`). The `enhanced-resolve` configuration was disconnected from the user's actual Vite setup, causing resolution to fail for any non-trivial project structure. This created an inconsistent and broken execution environment.

**New Implementation**

The new solution provides a direct bridge into the user's actual development sandbox instead of creating a synthetic one.

1.  **Leverage the User's Dev Server**: The `rwsdk worker-run` command now starts the user's real Vite dev server by loading their `vite.config.mts` file. This ensures the execution environment is identical to the one they use for regular development, respecting all aliases and plugins.
2.  **Introduce a `/__worker-run` Endpoint**: A special, dev-only route, `/__worker-run`, is added to the fetch handler in the worker runtime.
3.  **Execute via `fetch`**: The `worker-run` command sends a `fetch` request to this endpoint, passing the path to the target script as a URL query parameter.
4.  **Dynamic Import**: The handler for the route receives this request inside the running worker and uses a dynamic `import()` to load and execute the script.

This method removes the fragile and incomplete resolution logic, ensuring that scripts run with the exact same configuration and context as the main application.
