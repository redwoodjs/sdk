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
