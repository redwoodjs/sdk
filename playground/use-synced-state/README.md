# useSyncedState Playground

This playground example demonstrates and tests the `useSyncedState` feature, which keeps state synchronized across browser tabs, devices, and users using realtime updates through Cloudflare Durable Objects.

## What It Tests

This playground validates the complete integration of the `useSyncedState` feature:

1. **Initial State Sync**: New clients receive existing state from the Durable Object
2. **State Updates**: Changes propagate to all subscribed clients in real-time
3. **Multiple Keys**: Independent state management per key (counter and message are separate)
4. **Cross-Context Sync**: State updates in one browser context appear in another

## Running Locally

From the playground directory:

```bash
pnpm install
pnpm dev
```

Point your browser to the URL displayed in the terminal (e.g. `http://localhost:5173/`).

## Testing

To run the end-to-end tests from the monorepo root:

```bash
pnpm test:e2e -- playground/use-synced-state/__tests__/e2e.test.mts
```

The tests verify that:

- State synchronizes correctly across multiple browser contexts
- Multiple keys (counter and message) operate independently
- Updates from one context are immediately visible in other contexts

## How It Works

The playground uses:

- **Client Hook**: `useSyncedState` from `rwsdk/use-sync-state` to manage synchronized state
- **Server Routes**: `syncedStateRoutes` from `rwsdk/use-sync-state/worker` to handle WebSocket RPC connections
- **Durable Object**: `SyncedStateServer` stores state and broadcasts updates to all subscribers

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [useSyncedState Documentation](https://docs.rwsdk.com/core/usesyncedstate/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
