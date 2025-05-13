---
description: RedwoodSDK: Middleware
globs: worker.tsx,middleware.ts,middleware.tsx
alwaysApply: false
---


# RedwoodSDK: Middleware

You're an expert at Cloudflare, TypeScript, and building web apps with RedwoodSDK. Generate high quality **RedwoodSDK middleware** that adhere to the following best practices:

## Guidelines

1. Create focused, single-responsibility middleware functions
2. Organize middleware in dedicated files (e.g., `middleware.ts`, `middleware.tsx`)
3. Use typed parameters and return values
4. Include clear error handling and logging
5. Follow the principle of least privilege
6. Implement proper security headers and CORS policies
7. Optimize for performance with caching strategies

## What is Middleware?

Middleware functions in RedwoodSDK are functions that run on every request before your route handlers. They can:

- Add security headers
- Handle CORS
- Implement caching strategies
- Add request/response logging
- Transform request/response data
- Implement rate limiting
- Add performance monitoring
- Handle error boundaries
- Setup sessions
- Authenticate users

## Example Templates

### Basic Middleware Structure

```tsx
export default defineApp([
  setCommonHeaders(),
  async ({ ctx, request, headers }) => {
    await setupDb(env);
    setupSessionStore(env);
    try {
      // Grab the session's data.
      ctx.session = await sessions.load(request);
    } catch (error) {
      if (error instanceof ErrorResponse && error.code === 401) {
        await sessions.remove(request, headers);
        headers.set("Location", "/user/login");

        return new Response(null, {
          status: 302,
          headers,
        });
      }

      throw error;
    }

    // Populate the ctx with the user's data
    if (ctx.session?.userId) {
      ctx.user = await db.user.findUnique({
        where: {
          id: ctx.session.userId,
        },
      });
    }
  },
  // Route handlers
]);
```
