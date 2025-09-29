# RedwoodSDK Passkey Addon

This addon provides passkey (WebAuthn) authentication for a RedwoodSDK project.

## How to add to your project

These instructions assume you are starting with a new RedwoodSDK project, for example from `npx create-rwsdk -t minimal my-project-name`.

### 0. Decide whether to add this manually or via AI

To use your editor's AI agent support to add this addon for you (e.g. Cursor, VSCode Copilot):
1. Make sure your project dir is open in your editor. You can create a new project with: `npx create-rwsdk -t minimal my-project-name`
2. Open a new AI chat window for your project
3. Make sure you are in `Agent` mode
4. Send the following chat prompt in the chat window - it will do the rest for you!

```
Please apply this addon to my RedwoodSDK project using these instructions: https://raw.githubusercontent.com/redwoodjs/passkey-addon/refs/heads/main/README.md
```

Alternatively, to apply this addon manually, simply follow the steps below.

### 1. Download this addon

```
npx degit redwoodjs/sdk-experiments/passkey-addon _tmp_passkey_addon
```

### 2. Copy files

Copy the `src` directory from this addon into your project's root directory. This will add the following directories:

- `src/passkey`: Core logic for passkey authentication.
- `src/session`: Session management using a Durable Object.

### 3. Update `package.json`

Copy the `dependencies` in the addon's `package.json` to your own application's `package.json`:

```json
"dependencies": {
  "@simplewebauthn/browser": "...",
  "@simplewebauthn/server": "..."
  ...
}
```

Then run `pnpm install`.

### 4. Update `wrangler.jsonc`

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

### 5. Update `src/worker.tsx`

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

### 6. Update `src/app/pages/Home.tsx`

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

### 7. Run the dev server

The first time you run the development server, it will generate the `.wrangler` folder and local Cloudflare environment.

```shell
pnpm dev
```


This will ensure that all the environmental types needed for the Passkey Auth are generated

You should now have a working passkey authentication flow in your RedwoodSDK application!