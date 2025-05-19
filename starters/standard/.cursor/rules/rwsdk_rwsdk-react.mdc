---
description: RedwoodSDK: React, React Server Components, and React Server Functions Rules
globs: src/app/**/*/*.tsx,Document.tsx
alwaysApply: false
---

# React, React Server Components, and React Server Functions Rules

## React Server Components (RSC)

1. By default, all components are server components unless explicitly marked as client components.
2. Server components are rendered on the server as HTML and streamed to the browser.
3. Server components cannot include client-side interactivity (state, effects, event handlers).
4. Server components can directly fetch data and include it in the initial payload.
5. Server components can be async and can be wrapped in Suspense boundaries.

Example:

```tsx
export default function MyServerComponent() {
  return <div>Hello, from the server!</div>;
}
```

## Client Components

1. Must be explicitly marked with the "use client" directive at the top of the file.
2. Required when the component needs:
   - Interactivity (click handlers, state management)
   - Browser APIs
   - Event listeners
   - Client-side effects
   - Client-side routing
3. Will be hydrated by React in the browser.

Example:

```tsx
"use client";

export default function MyClientComponent() {
  return <button onClick={() => console.log("clicked")}>Click me</button>;
}
```

## Data Fetching in Server Components

1. Server components can directly fetch data without useEffect or other client-side data fetching methods.
2. Use Suspense boundaries to handle loading states for async server components.
3. Pass context (ctx) through props to child components that need it.

Example:

```tsx
export async function TodoList({ ctx }) {
  const todos = await db.todo.findMany({ where: { userId: ctx.user.id } });

  return (
    <ol>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ol>
  );
}
```

## Server Functions

1. Must be marked with the "use server" directive at the top of the file.
2. Can be imported and used in client components.
3. Execute on the server when called from client components.
4. Have access to the request context via requestInfo.ctx.
5. Can handle form submissions and other server-side operations.

Example:

```tsx
"use server";

import { requestInfo } from "rwsdk/worker";

export async function addTodo(formData: FormData) {
  const { ctx } = requestInfo;
  const title = formData.get("title");
  await db.todo.create({ data: { title, userId: ctx.user.id } });
}
```

## Context Usage

1. Context is available to all server components and server functions.
2. Access context via:
   - requestInfo in server functions:
   ```
   import { requestInfo } from "rwsdk/worker";
   const { ctx } = requestInfo
   ```
3. Context is populated by middleware and interruptors and is request-scoped.

## Best Practices

1. Keep server components as the default choice unless client-side interactivity is needed.
2. Use client components only when necessary to minimize the JavaScript bundle size.
3. Leverage server components for data fetching and initial rendering.
4. Use Suspense boundaries appropriately for loading states.
5. Keep client components as small as possible, moving server-side logic to server components or server functions.
6. Always mark client components with "use client" directive.
7. Always mark server functions with "use server" directive.

