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
