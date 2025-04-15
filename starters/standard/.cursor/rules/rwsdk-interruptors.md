---
description:
globs:
alwaysApply: false
---

# RedwoodSDK: Request Interruptors

You're an expert at Cloudflare, TypeScript, and building web apps with RedwoodSDK. Generate high quality **RedwoodSDK interruptors** (middleware functions) that adhere to the following best practices:

## Guidelines

1. Create focused, single-responsibility interruptors
2. Organize interruptors in dedicated files (e.g., `interruptors.ts`, `interceptors.ts`, or `middleware.ts`)
3. Compose interruptors to create more complex validation chains
4. Use typed parameters and return values
5. Include clear error handling and user feedback

## What are Interruptors?

Interruptors are middleware functions that run before your route handlers. They can:

- Validate user authentication and authorization
- Transform request data
- Validate inputs
- Rate limit requests
- Log activity
- Redirect users based on conditions
- Short-circuit request handling with early responses

## Example Templates

### Basic Interruptor Structure

```tsx
async function myInterruptor({ request, params, ctx }) {
  // Perform checks or transformations here

  // Return modified context to pass to the next interruptor or handler
  ctx.someAddedData = "value";

  // OR return a Response to short-circuit the request
  // return new Response('Unauthorized', { status: 401 });
}
```

### Authentication Interruptors

```tsx
import { getSession } from "@redwoodjs/sdk/auth";

export async function requireAuth({ request, ctx }) {
  const session = await getSession(request);

  if (!session) {
    // Redirect to login if not authenticated
    return Response.redirect("/login");
  }

  // Pass session to the handler
  return { ...ctx, session };
}

export async function requireAdmin({ request, ctx }) {
  const session = await getSession(request);

  if (!session) {
    return Response.redirect("/login");
  }

  if (session.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  return { ...ctx, session };
}
```

### Input Validation Interruptor

```tsx
import { z } from "zod";

// Create a reusable validator interruptor
export function validateInput(schema) {
  return async function validateInputInterruptor({ request, ctx }) {
    try {
      const data = await request.json();
      const validated = schema.parse(data);

      return { ...ctx, data: validated };
    } catch (error) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }
  };
}

// Usage example with a Zod schema
const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18).optional(),
});

export const validateUser = validateInput(userSchema);
```

### Rate Limiting Interruptor

```tsx
// Simple in-memory rate limiting (use a distributed cache in production)
const requestCounts = new Map();

export function rateLimit(maxRequests, windowMs) {
  return async function rateLimitInterruptor({ request, ctx }) {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();

    // Get or initialize request history for this IP
    const history = requestCounts.get(ip) || [];

    // Filter out requests outside the time window
    const recentRequests = history.filter((time) => now - time < windowMs);

    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      return Response.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (windowMs - (now - recentRequests[0])) / 1000,
            ),
          },
        },
      );
    }

    // Add current request timestamp and update map
    requestCounts.set(ip, [...recentRequests, now]);

    return ctx;
  };
}

// Limit to 10 requests per minute
export const apiRateLimit = rateLimit(10, 60 * 1000);
```

### Logging Interruptor

```tsx
export async function logRequests({ request, ctx }) {
  const start = Date.now();

  // Add a function to the context that will log when called
  return {
    ...ctx,
    logCompletion: (response) => {
      const duration = Date.now() - start;
      const status = response.status;

      console.log(
        `${request.method} ${request.url} - ${status} (${duration}ms)`,
      );
    },
  };
}

// Usage in a route handler
export const handler = [
  logRequests,
  async (request, { logCompletion }) => {
    // Process the request
    const response = Response.json({ success: true });

    // Call the logging function
    logCompletion(response);

    return response;
  },
];
```

### Composing Multiple Interruptors

```tsx
import { route } from "@redwoodjs/sdk/router";
import {
  requireAuth,
  validateUser,
  apiRateLimit,
  logRequests,
} from "./interruptors";

// Combine multiple interruptors
route("/api/users", {
  POST: [
    logRequests, // Log all requests
    apiRateLimit, // Apply rate limiting
    requireAuth, // Ensure user is authenticated
    validateUser, // Validate user input
    async (request, { data, session }) => {
      // Handler receives validated data and session from interruptors
      const newUser = await db.user.create({
        data: {
          ...data,
          createdBy: session.userId,
        },
      });

      return Response.json(newUser, { status: 201 });
    },
  ],
});
```

### Role-Based Access Control

```tsx
import { getSession } from "@redwoodjs/sdk/auth";

// Create a function that generates role-based interruptors
export function hasRole(allowedRoles) {
  return async function hasRoleInterruptor({ request, ctx }) {
    const session = await getSession(request);

    if (!session) {
      return Response.redirect("/login");
    }

    if (!allowedRoles.includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    return { ...ctx, session };
  };
}

// Create specific role-based interruptors
export const isAdmin = hasRole(["ADMIN"]);
export const isEditor = hasRole(["ADMIN", "EDITOR"]);
export const isUser = hasRole(["ADMIN", "EDITOR", "USER"]);
```

### Organization with Co-located Interruptors

Create a file at `./src/app/interruptors.ts`:

```tsx
import { getSession } from "@redwoodjs/sdk/auth";

// Authentication interruptors
export async function requireAuth({ request, ctx }) {
  const session = await getSession(request);

  if (!session) {
    return Response.redirect("/login");
  }

  return { ...ctx, session };
}

// Role-based interruptors
export function hasRole(allowedRoles) {
  return async function hasRoleInterruptor({ request, ctx }) {
    const session = await getSession(request);

    if (!session) {
      return Response.redirect("/login");
    }

    if (!allowedRoles.includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    return { ...ctx, session };
  };
}

export const isAdmin = hasRole(["ADMIN"]);
export const isEditor = hasRole(["ADMIN", "EDITOR"]);

// Other common interruptors
export async function logRequests({ request, ctx }) {
  console.log(`${request.method} ${request.url}`);
  return ctx;
}
```

Then import these interruptors in your route files:

```tsx
// src/app/pages/admin/routes.ts
import { route } from "@redwoodjs/sdk/router";
import { isAdmin, logRequests } from "@/app/interruptors";

import { AdminDashboard } from "./AdminDashboard";
import { UserManagement } from "./UserManagement";

export const routes = [
  route("/", [isAdmin, logRequests, AdminDashboard]),
  route("/users", [isAdmin, logRequests, UserManagement]),
];
```
