# Request-Scoped State Examples

This playground demonstrates the request-scoped state API with a simple counter object.

## What it demonstrates

- **State Isolation**: Each request gets its own isolated counter instance
- **Server-Side Usage**: Shows how state persists during server-side rendering
- **Client-Side Usage**: Demonstrates interactive state management
- **Cross-Request Safety**: Multiple concurrent requests don't interfere with each other

## Running the example

```bash
cd playground/request-scoped-state-examples
pnpm install
pnpm dev
```

## Key Files

- `src/counter.ts` - Simple stateful Counter class
- `src/counterState.ts` - Request-scoped state setup using `defineRequestState`
- `src/CounterServer.tsx` - Server-side component demonstrating state isolation
- `src/CounterDemo.tsx` - Client-side interactive component

## Testing Isolation

1. Open the app in multiple browser tabs
2. Initialize counters in different tabs
3. Increment/decrement in different tabs
4. Observe that each tab maintains its own independent counter state

This demonstrates that the request-scoped state API successfully isolates state between concurrent requests, preventing the cross-request promise resolution issues that occur with module-level singletons.
