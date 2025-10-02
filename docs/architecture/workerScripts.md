# Executing Worker Scripts

This document details the mechanism for running one-off scripts, such as database seeds, within the context of the application's worker environment. It explains how the system provides a bridge into the isolated development sandbox, allowing scripts to run with the full application context.

## The Challenge: Operating Inside the Sandbox

The development server, powered by Vite and the Cloudflare Vite plugin, creates an isolated sandbox environment that emulates the Cloudflare Workers runtime using Miniflare. All runtime resources, including environment variables, bindings, and storage, exist only within this sandbox. This is particularly relevant for data persistence:

-   **Durable Object Storage**: Databases built with `rwsdk/db` (using Kysely and SQLite Durable Objects) store their state within the Miniflare sandbox.
-   **D1 Databases**: When using D1 with a tool like Prisma, in dev, the underlying SQLite database file is managed via Miniflare.

This isolation creates a challenge for common development tasks like database seeding. To populate the database, a seed script needs access to the exact same environment as the application. It needs to run *inside* the sandbox to access the database bindings and use the same clients (like Kysely or Prisma) that the application code uses. The goal is to ensure consistency: the way a developer seeds their database should be the same way their application interacts with it.

### The Initial Approach: A Synthetic Sandbox

The first implementation of the `rwsdk worker-run` command attempted to solve this by creating a *different*, synthetic sandbox. The process was:

1.  **Parse the User's Worker**: The script would read the user's `src/worker.tsx` and use an AST parser to find exported Durable Object classes.
2.  **Generate a Virtual Entry Point**: It would then generate a temporary worker file that re-exported these Durable Objects and set the target script (e.g., `seed.ts`) as the default export.
3.  **Run a Hardcoded Vite Server**: Finally, it would spin up a Vite server with a minimal, hardcoded configuration using this virtual entry point.

This approach failed to provide a true solution because the sandbox it created was not the same as the user's actual development environment.

-   **Inconsistent Environment**: The hardcoded Vite server was completely disconnected from the user's `vite.config.mts`. This meant any custom plugins, path aliases, or other project-specific configurations were ignored, breaking the principle of a consistent environment.
-   **Brittleness**: The AST parsing was fragile and made assumptions about how users would structure their code.
-   **Complexity**: Generating temporary files added unnecessary complexity.

## The Solution: A Bridge into the Dev Server

The current solution provides a direct bridge into the user's actual development sandbox. It works by introducing a special, dev-only route directly into the worker's runtime.

1.  **Leverage the User's Dev Server**: The `rwsdk worker-run` command starts the user's real Vite dev server by loading their `vite.config.mts` file. This ensures the execution environment is identical to the one they use for regular development.
2.  **Introduce a `/__worker-run` Endpoint**: A special route, `/__worker-run`, is added to the fetch handler in the worker runtime. This route is only active in development (`import.meta.env.DEV`).
3.  **Execute via `fetch`**: The `worker-run` command starts the server and then sends a `fetch` request to this endpoint, passing the path to the target script as a URL query parameter (e.g., `http://localhost:8787/__worker-run?script=./src/scripts/seed.ts`).
4.  **Dynamic Import and Execution**: The handler for the `/__worker-run` route receives this request inside the running worker, extracts the script path, and uses a dynamic `import()` to load and execute it.

This method is simpler and more robust. It provides a clean entry point into the *actual* development sandbox, ensuring that scripts run with the exact same configuration, bindings, and context as the main application.
