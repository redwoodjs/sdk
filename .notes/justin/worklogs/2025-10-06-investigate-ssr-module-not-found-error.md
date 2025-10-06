# Investigating SSR Module and Hook Errors

**Date**: 2025-10-06

## Context

I'm working through the steps of a presentation demo script for a sample application to ensure the flow is correct. The process involves incrementally enabling features in `src/worker.tsx` to showcase the framework's capabilities, moving from simple server-side rendering to a fully interactive, real-time application.

The progression is as follows:
1.  **Basic SSR & Middleware**: Simple, non-interactive pages.
2.  **API and Simple Todos**: Server-rendered forms posting to API routes.
3.  **Client-Side Hydration & Auth**: Introducing a client-side JS bundle for interactivity on some routes.
4.  **"Fancy" Todos**: A more complex, interactive page using modern React features.
5.  **Real-Time**: A page with WebSocket-based real-time updates.

The first three steps proceeded as expected.

## Problem

Upon enabling the routes for Step 4 ("Fancy Todos") and Step 5 ("Real-time"), the development server began throwing errors during server-side rendering (SSR).

The initial error reported by Vite is a module resolution failure:

```
Internal server error: (ssr) No module found for '/src/app/pages/todos/Todos.tsx' in module lookup for "use client" directive
```

A similar error was observed for `/src/app/pages/todos/TodoItem.tsx`.

This appears to cause a downstream React error during rendering: `Invalid hook call`, which manifests as `TypeError: Cannot read properties of null (reading 'use')` and `TypeError: Cannot read properties of null (reading 'useOptimistic')`.

## Investigation Plan

The issue seems to stem from how client components (those marked with `"use client"`) are being handled by the server-side rendering process. The SSR environment is failing to resolve these modules correctly, which leads to React's hooks context being unavailable, causing the `Invalid hook call` error.

My next steps will be to investigate the module resolution process for client components during SSR.
