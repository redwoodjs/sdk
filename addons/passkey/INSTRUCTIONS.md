# RedwoodSDK Passkey Addon Setup

These instructions will guide you through integrating the Passkey addon into your RedwoodSDK project.

### 1. Copy addon files

Copy the `src` directory from this addon into your project's `src` directory. This will add the following directories:

- `src/passkey`: Core logic for passkey authentication.
- `src/session`: Session management using a Durable Object.

### 2. Update `package.json`

Copy the `dependencies` in this addon's `package.json` to your own application's `package.json`:

```json
"dependencies": {
  "@simplewebauthn/browser": "...",
  "@simplewebauthn/server": "..."
  ...
}
```

Then run `pnpm install`.

### 3. Update `wrangler.jsonc`

Update your `wrangler.jsonc` to add Durable Object bindings, environment variables, and database migrations.

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

Modify your `src/worker.tsx` to integrate the passkey authentication and routes.

```typescript
// ...

import { authRoutes } from "@/passkey/routes";
import { setupPasskeyAuth } from "@/passkey/setup";
import { Session } from "@/session/durableObject";

export { SessionDurableObject } from "@/session/durableObject";
export { PasskeyDurableObject } from "@/passkey/durableObject";

export type AppContext = {
  // ...
  session: Session | null;
};

export default defineApp([
  // ...
  setCommonHeaders(),
  setupPasskeyAuth(),
  render(Document, [
    // ...
    index([
      ({ ctx }) => {
        if (!ctx.session?.userId) {
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

### 5. Update `src/app/pages/Home.tsx`

Add a login link to your `Home.tsx` page.

```typescript
// ...

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      {/* ... */}
      <p>
        <a href="/auth/login">Login</a>
      </p>
    </div>
  );
}
```

### 6. Run the dev server

The first time you run the development server, it will generate the `.wrangler` folder and local Cloudflare environment.

```shell
pnpm dev
```

This will ensure that all the environmental types needed for the Passkey Auth are generated

You should now have a working passkey authentication flow in your RedwoodSDK application!