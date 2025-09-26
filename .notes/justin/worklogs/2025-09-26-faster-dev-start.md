## PR Description

### Problem

The development server's startup time is negatively affected by the `dev:init` script, which blocks startup while running `generate`, `migrate:dev`, and `seed` tasks. For projects that do not use a database and only require type generation, waiting for the full sequence imposes an unnecessary delay.

### Solution

This change alters the `dev:init` script to conditionally block the startup process. It now inspects the project's `package.json` to determine if database-related scripts (`migrate:dev`, `seed`) are defined.

- If database scripts are present, the initialization process remains unchanged, running all tasks sequentially to ensure the database is ready before the server starts.
- If only a `generate` script is found, the script runs the type generation and then exits immediately. This unblocks the dev server, allowing it to proceed with startup much sooner, while the logs indicate that generation is happening.

This approach reduces the startup time for projects that do not require database migrations or seeding during development.
