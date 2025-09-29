# RedwoodSDK Passkey Addon

This addon provides passkey (WebAuthn) authentication for a RedwoodSDK project.

## How to add to your project

These instructions assume you are starting with a RedwoodSDK project.

### 1. Copy addon files

Copy the `src` directory from this addon into your project's `src` directory. This will add the following directories:

- `src/passkey`: Core logic for passkey authentication.
- `src/session`: Session management using a Durable Object.

### 2. Update `package.json`

Add the following dependencies to your `package.json` file:

```json
"dependencies": {
  "@simplewebauthn/browser": "^13.1.0",
  "@simplewebauthn/server": "^13.1.1"
}
```

Then run your package manager's install command (e.g., `pnpm install`).

### 3. Update `wrangler.jsonc`

Update your `wrangler.jsonc` to add Durable Object bindings and database migrations.

```jsonc
{
  // ... existing configuration ...

  // Durable Objects configuration
  "durable_objects": {
    "bindings": [
      {
        "name": "SESSION_DURABLE_OBJECT",
        "class_name": "SessionDurableObject"
      },
      {
        "name": "PASSKEY_DURABLE_OBJECT",
        "class_name": "PasskeyDurableObject"
      }
    ]
  },

  // Migrations
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["PasskeyDurableObject"]
    }
  ]
}
```

### 4. Update `src/worker.tsx`

Modify your `src/worker.tsx` to integrate the passkey authentication. You will need to import the necessary components and add the `setupPasskeyAuth` middleware. The example below shows a protected home route.

```typescript
// src/worker.tsx

import { defineApp, render, index, prefix } from "rwsdk/app";
import { Document } from "./app/Document";
import { Home } from "./app/pages/Home";
import { setCommonHeaders } from "./app/headers";

import { authRoutes } from "./passkey/routes";
import { setupPasskeyAuth } from "./passkey/setup";
import { Session } from "./session/durableObject";

export { SessionDurableObject } from "./session/durableObject";
export { PasskeyDurableObject } from "./passkey/durableObject";

export type AppContext = {
  session: Session | null;
};

export default defineApp([
  setCommonHeaders(),
  setupPasskeyAuth(),
  render(Document, [
    index([
      ({ ctx }) => {
        if (!ctx.session?.userId) {
          // Redirect to login if not authenticated
          return new Response(null, {
            status: 302,
            headers: { Location: "/auth/login" },
          });
        }
      },
      Home,
    ]),
    prefix("/auth", authRoutes()),
  ]),
]);
```

You should now have a working passkey authentication flow in your RedwoodSDK application.