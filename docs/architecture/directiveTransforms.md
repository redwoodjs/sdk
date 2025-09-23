# Architecture: Directive Transformations

This document details how the SDK build process transforms modules containing `"use client"` and `"use server"` directives. These transformations are essential for allowing React Server Components (RSC) and traditional Server-Side Rendering (SSR) to coexist and interact within a single environment.

## "use client" Modules

### The Challenge: A Module with a Dual Identity

A module marked with `"use client"` has a dual responsibility in our hybrid rendering system. It must behave differently in two distinct phases of a single server-side request:

1.  **During the RSC Pass:** The module's implementation must be completely hidden from the server. The renderer should only see a serializable "Client Reference"—a placeholder that tells the browser which component to download and hydrate.
2.  **During the SSR Pass:** The module's *actual* implementation is needed so it can be rendered into the initial HTML, providing content to users before JavaScript loads. This is critical for both performance and SEO.

Furthermore, a "use client" module might export more than just React components. It could export utility functions, constants, or objects that are needed by Server Components during the SSR pass. The transformation must accommodate this, allowing server-side code to import and use these non-component exports seamlessly, as if they were regular server-side modules.

### The Solution: Environment-Specific Transformations

The solution is to transform the module's code differently for each of Vite's three environments (`worker`, `ssr`, and `client`), using the SSR Bridge to connect them.

#### The `worker` Environment Transformation

This is the most complex case, as the `worker` environment handles both the RSC and SSR passes. The transformation replaces the module's contents with proxies that can satisfy both contexts.

**Before Transformation (`src/components/Form.tsx`):**
```tsx
"use client";

import { useState } from 'react';

// A utility object also exported from the client module
export const FormUtils = {
  isValid: (value: string) => value.length > 0,
};

// A React component
export function Form() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

**After Transformation (in `worker` environment):**
```tsx
// 1. Import the SSR version of the module via the SSR Bridge.
// This makes the *actual* implementation available for the SSR pass.
import * as SSRModule from "virtual:rwsdk:ssr:/src/components/Form.tsx";

// 2. Import the factory function that creates client references.
import { registerClientReference } from "rwsdk/worker";

// 3. Create proxies for each export.
// The runtime function will decide what to do with them.
export const FormUtils = registerClientReference(SSRModule, "/src/components/Form.tsx", "FormUtils");
export const Form = registerClientReference(SSRModule, "/src/components/Form.tsx", "Form");
```

At runtime, the `registerClientReference` function inspects each export from the `SSRModule`.
-   If an export is a **React component**, it returns a serializable Client Reference placeholder for the RSC pass.
-   If an export is a **non-component** (like `FormUtils`), it returns the *actual object* from `SSRModule`, making it directly usable by server-side code during the SSR pass.

#### The `ssr` and `client` Environment Transformations

In these environments, the module's full implementation is always needed. The only required transformation is to remove the `"use client"` directive so the code executes as a standard module.

**After Transformation (in `ssr` or `client` environments):**
```tsx
// "use client" is removed. The rest of the code is untouched.
import { useState } from 'react';

export const FormUtils = { /* ... */ };
export function Form() { /* ... */ }
```

## "use server" Modules

### The Challenge: A Secure Boundary for Server Code

A module marked `"use server"` contains functions that must only ever execute on the server. However, they need to be callable from client-side code (e.g., from a form submission). The challenge is to create a secure, transparent boundary that transforms a client-side function call into a server-side execution (an RPC call) without exposing the function's implementation to the browser.

### The Solution: RPC Proxies and Server-Side Registration

The solution is to again transform the module based on the environment. The `client` and `ssr` environments get RPC stubs, while the `worker` gets the actual implementation plus registration code.

#### The `client` and `ssr` Environment Transformations

For any context that is not the main `worker` environment, the entire implementation of the module is stripped away and replaced with RPC proxies created by `createServerReference`.

**Before Transformation (`src/actions/sendMessage.ts`):**
```ts
"use server";

export async function sendMessage(message: string) {
  // ... database logic
  return { success: true };
}
```

**After Transformation (in `client` or `ssr` environments):**
```ts
// The implementation is gone. We now have an RPC stub.
import { createServerReference } from "rwsdk/client"; // or rwsdk/__ssr

export let sendMessage = createServerReference("/src/actions/sendMessage.ts", "sendMessage");
```

#### The `worker` Environment Transformation

In the `worker`, where the code needs to execute, the transformation is more subtle. The `"use server"` directive is removed, and a call to `registerServerReference` is appended for each export. This registration step attaches the necessary metadata to the function, allowing the framework's RPC layer to route incoming client calls to the correct function.

**After Transformation (in `worker` environment):**
```ts
// "use server" is removed.
import { registerServerReference } from "rwsdk/worker";

export async function sendMessage(message: string) {
  // ... database logic
  return { success: true };
}

// The original function is registered with the framework's RPC handler.
registerServerReference(sendMessage, "/src/actions/sendMessage.ts", "sendMessage");
```
