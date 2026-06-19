# useSyncedState Hibernation Playground

This playground example demonstrates and tests the `useSyncedState` hibernation transport, which keeps state synchronized across browser tabs, devices, and users using realtime updates through Cloudflare Durable Objects with the Hibernation API.

## What It Tests

This playground validates the complete integration of the hibernation-aware `useSyncedState` transport:

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
pnpm test:e2e -- playground/use-synced-state-hibernation/__tests__/e2e.test.mts
```

## How It Works

The playground uses:

- **Client Hook**: `useSyncedState` from `rwsdk/use-synced-state/hibernation/client`
- **Server Routes**: `syncedStateRoutes` from `rwsdk/use-synced-state/hibernation/worker`
- **Durable Object**: `SyncedStateServer` stores state and broadcasts updates to all subscribers while allowing the DO to hibernate when idle

The regular capnweb-based `useSyncedState` playground is in `playground/use-synced-state`.

## Further Reading

- [RedwoodSDK Documentation](https://docs.rwsdk.com/)
- [useSyncedState Documentation](https://docs.rwsdk.com/core/usesyncedstate/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
