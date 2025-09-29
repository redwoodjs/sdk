*   **Run Passkey E2E Tests**: Run `pnpm test:e2e -- playground/passkey` to validate the test setup and initial interactions.

### Architectural Shift: Passkey DB Ownership

A key challenge has been identified in the passkey integration: **database ownership**.

**The Problem:** The initial implementation placed the passkey database schema (`migrations.ts`) and data access functions (`createUser`, `getCredentialById`, etc.) inside the SDK. This is a flawed approach because it forces a specific data model onto the user and assumes we can own their database schema. A user's data model is their own concern; they may have different fields, existing user tables, or different database technologies entirely.

**The Solution: Dependency Injection**

To solve this, we will refactor the passkey feature to use a dependency injection pattern. This creates a clear contract between the SDK and the user's code, establishing the correct "split point":

1.  **User Owns the DB:** The entire database layer—including migrations, the `db.ts` file, and all data access functions—will be moved out of the SDK and into user-land (in this case, the `playground/passkey` example). The user is responsible for implementing a "DB API" that provides a set of required functions (e.g., `createUser`, `createCredential`).

2.  **SDK Consumes the DB API:**
    *   The SDK's `setupPasskeyAuth` function will be modified to accept the user's DB API object as an argument: `setupPasskeyAuth(passkeyDb)`.
    *   This setup function will attach the user's `passkeyDb` object to the globally available `requestInfo` context, making it accessible throughout the request.

3.  **SDK Functions Use the Injected API:** The SDK's core passkey functions (`finishPasskeyRegistration`, etc.) will no longer import database functions directly. Instead, they will call them from the context: `requestInfo.rw.passkeyDb.createUser(...)`.

This approach gives the user full control over their database implementation while still benefiting from the complex WebAuthn logic provided by the SDK. It's a more flexible and robust architecture.

### Strategy: Providing Defaults for Common Patterns

**Problem:** While the dependency injection pattern is flexible, it requires users to copy and maintain a significant amount of boilerplate for the database and session management, even for a standard setup. This creates friction for users who just want a working passkey implementation without writing custom persistence logic.

**Solution: Default Factory Functions**

To solve this, I will introduce "factory functions" within the SDK that create default, production-ready implementations for the passkey database and session store. Users can use these defaults out-of-the-box with zero configuration, or provide options to customize them. This preserves the flexibility of the architecture while drastically improving the developer experience for common use cases.

1.  **`createDefaultPasskeyDb(options)`:**
    *   This function will be exported from the SDK and will return a complete passkey DB API object (`createUser`, `getCredential`, etc.), backed by a SQLite Durable Object.
    *   It will accept an `options` object:
        *   `durableObject`: The Durable Object namespace binding. (Defaults to `env.PASSKEY_DURABLE_OBJECT`)
        *   `name`: The name for the singleton DO instance. (Defaults to `"passkey-main"`)

2.  **`createDefaultSessionStore(options)`:**
    *   This function will return a session store instance, also backed by a Durable Object.
    *   It will accept an `options` object:
        *   `durableObject`: The Durable Object namespace binding. (Defaults to `env.SESSION_DURABLE_OBJECT`)

3.  **Updated `setupPasskeyAuth(options)`:**
    *   The primary `setupPasskeyAuth` function will be updated to orchestrate these defaults.
    *   It will accept an `options` object:
        *   `passkeyDb`: A user-provided DB API. (If not provided, it will default to calling `createDefaultPasskeyDb()`).
        *   `sessions`: A user-provided session store. (If not provided, it will default to calling `createDefaultSessionStore()`).

This design allows for a simple, zero-config setup for most users (`setupPasskeyAuth()`), while still enabling advanced users to override any part of the implementation (`setupPasskeyAuth({ passkeyDb: myCustomDb })`).

### Final Decision: The Co-Located Addon (aka "Bundled Addon")

After extensive back-and-forth, we have landed on a final architecture that we believe correctly balances developer experience, flexibility, and long-term maintainability. The core challenge was providing a first-class, "batteries-included" authentication solution without creating a "black box" that users couldn't customize, and without creating a versioning nightmare.

Here is a summary of the approaches we considered and why we ultimately chose the "Co-located Addon" model.

#### Attempt 1: In-SDK Defaults with Dependency Injection

- **The Idea:** Provide `createDefaultPasskeyDb` and `createDefaultSessionStore` functions within the SDK. The main `setupPasskeyAuth` function would use these by default, but allow advanced users to pass in their own custom implementations.
- **Why we rejected it:** This created a rigid API contract. The user's database logic would have to conform to *our* specific interface (e.g., a function named `createUser` with a specific signature). This is inflexible and often creates more work for the user (writing adapters) than it saves. More importantly, the default implementation was a "black box"—the schema and logic were hidden inside the SDK's compiled code, making it impossible for a user to inspect or modify.

#### Attempt 2: External Addon (The Original Approach)

- **The Idea:** Keep the entire passkey implementation in a separate repository. The user (or an AI agent) would follow a `README` to copy the files into their project.
- **Why we rejected it:** While this model correctly gives the user full ownership of the code, it creates a critical **versioning and stability crisis**. There is no way to guarantee that the `main` branch of the addon is compatible with the version of the SDK a user has installed. A breaking change in a core SDK API could silently break every project using the addon. It also feels disconnected and less "official," undermining the goal of making auth a first-class feature.

---

### The Solution: A Co-located, Version-Locked Addon

The final, chosen approach combines the best of both worlds.

- **What it is:** The entire passkey implementation (database, server functions, UI, etc.) will live as source code boilerplate inside an `sdk/addons/passkey` directory within the SDK monorepo. This directory is **not** part of the SDK's compiled code, but it is **published with the package** to NPM.

- **Why it's the right choice:**
    1.  **Atomic Versioning (The Most Important Point):** The addon is versioned and published *with* the SDK. The boilerplate in `rwsdk@1.2.0` is guaranteed to work with the `rwsdk@1.2.0` core library because they are from the same commit and tested together. This completely solves the stability problem.
    2.  **A Cohesive Documentation Story:** We can now officially document the auth solution. The docs for a specific SDK version can point to a **permanent, version-locked URL** for the addon's instructions: `.../sdk/v1.2.0/addons/passkey/README.md`. This makes it feel like an official, bundled feature, not a "jutting out thing."
    3.  **Total User Ownership:** The workflow remains the same: the user copies the source code into their project. It becomes *their* code. They are free to modify the schema, change the function signatures, and customize the UI. There is no black box and no rigid API contract.
    4.  **Enables Robust End-to-End Testing:** Because the addon lives in the same repository, we can create a playground example that applies the addon and run our full E2E test suite against it, ensuring this critical feature is always compatible with the core SDK.
    5.  **Keeps the Core SDK Clean:** The SDK's public API surface remains minimal and un-opinionated about authentication. It provides the generic primitives, and the addon provides a complete, but fully user-owned, implementation.

This is because it is both versioned and testable.

### Attempt 4: A Docs-First Approach with a CLI Helper

Upon reflection, creating a robust E2E test that programmatically uses an AI agent to apply the addon feels like a potential rabbit hole that could derail the immediate goal. While it remains a good long-term objective, a more pragmatic approach is needed now.

The decision is to pivot to a docs-first strategy. The primary way a user will add passkey authentication is by following the official documentation. The `playground/passkey` example will be removed in favor of this approach, with the functionality being manually tested for now.

To solve the critical issue of ensuring users get the correct, version-locked instructions for the addon, a CLI helper will be created. A command like `npx rw-scripts addon passkey` will be added. This command will read the `README.md` from within the installed `rwsdk` package (`node_modules/rwsdk/addons/passkey/README.md`) and print its contents directly to the console.

This approach has several advantages:
- It provides a single, reliable source of truth for instructions.
- The instructions are guaranteed to be in sync with the user's installed SDK version.
- The command is simple for both human users and AI agents to execute, fulfilling the goal of having an AI-friendly workflow.
- It avoids the complexity and non-determinism of building an AI-driven E2E test at this stage.

The authentication documentation will be completely overhauled to guide users to this new command.

### Attempt 5: Decoupling the Addon from the NPM Package

A refinement to the docs-first approach is to avoid shipping the addon source code within the published `rwsdk` npm package. This keeps the package lean for all users, especially those not using the passkey feature.

The new plan is as follows:
1. The `sdk/addons` directory will not be included in the files published to npm. It will exist only in the GitHub repository, versioned with git tags.
2. The `rw-scripts addon passkey` command will be modified. Instead of reading a local file, it will determine the currently installed version of `rwsdk`. It will then use this version to construct and print the exact GitHub URL for the addon's `README.md` at that specific git tag.
3. The documentation will be updated to reflect this. It will instruct users to run the command to get a version-locked URL. It will also provide a static link to the `README.md` on the `main` branch for users who wish to browse the latest version.

This approach maintains the key benefit of version-locking the instructions to the user's installed SDK version while significantly reducing the size of the installed package. The workflow remains simple for both users and AI agents, who can be instructed to fetch content from the provided URL.
