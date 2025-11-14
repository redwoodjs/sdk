# Realtime State Error Handling and Offline Queue

This document describes the planned error handling, retry logic, and offline queue system for `useSyncedState`.

## Challenge

Applications using `useSyncedState` need to handle network failures, disconnections, and transient errors without blocking the UI or losing user changes. The solution must provide visibility into sync status, retry failed operations, and optionally persist pending changes across page reloads.

## Current State

The existing `useSyncedState` hook applies updates optimistically in the client and forwards changes to the Durable Object via WebSocket RPC. However:

- Failed `setState` calls are silently ignored (marked with `void`)
- No retry logic for transient network failures
- No visibility into whether changes successfully synced
- No offline queue for disconnection scenarios
- Connection state is not exposed to components

## Planned Approach

### Connection Status Tracking

A connection manager tracks WebSocket state and exposes it through a separate hook:

- **Status states**: `connected`, `disconnected`, `reconnecting`
- **Per-key tracking**: Monitor which state keys have pending sync operations
- **Error surfacing**: Capture and expose sync errors to components

The existing realtime WebSocket client already reconnects automatically with a 5-second delay. The connection manager will hook into these events to update status and flush queued operations on reconnect.

### Retry with Exponential Backoff

When `setState` fails, the system retries up to 3 times with exponential backoff (1s, 2s, 4s). After exhausting retries:

- If disconnected: enqueue the operation for later
- If connected but failing: surface the error to the component

### Offline Queue

A pluggable queue interface allows users to choose persistence strategy:

```typescript
interface SyncStateQueue {
  enqueue(key: string, value: unknown): Promise<string>;
  dequeue(): Promise<PendingOperation | null>;
  dequeueAll(): Promise<PendingOperation[]>;
  remove(id: string): Promise<void>;
  peek(): Promise<PendingOperation | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
}
```

**Built-in implementations**:

1. **InMemoryQueue (default)**: Fast, no persistence, lost on page refresh
2. **IndexedDBQueue**: Persists across page reloads, async API, good for most production apps
3. **LocalStorageQueue**: Simple, synchronous, 5-10MB limit
4. **SqliteQueue**: Full SQL power in the browser (sql.js or OPFS), best for complex offline scenarios

When the WebSocket reconnects, the queue flushes all pending operations to the server in timestamp order.

### Status Hook

A separate `useSyncedStateStatus` hook provides opt-in monitoring:

```typescript
const { connected, syncing, status, error } = useSyncedStateStatus(key?);
```

- **connected**: Boolean indicating WebSocket connection state
- **syncing**: Boolean indicating whether operations are pending (global or for specific key)
- **status**: Current connection status (`connected` | `disconnected` | `reconnecting`)
- **error**: Last error encountered for the key (if any)

This follows the pattern used by libraries like Liveblocks, keeping the primary API simple while allowing status monitoring when needed.

## Usage Examples

### Default Behavior

```typescript
const [count, setCount] = useSyncedState(0, "counter");
```

Uses InMemoryQueue by default. Handles transient network failures with automatic retry. Optimistic updates keep the UI responsive. Queue is lost on page refresh.

### With Status Monitoring

```typescript
const [count, setCount] = useSyncedState(0, "counter");
const { connected, syncing, error } = useSyncedStateStatus("counter");

if (!connected) {
  return <Banner>Working offline - changes will sync when reconnected</Banner>;
}

if (error) {
  toast.error(`Failed to sync: ${error.message}`);
}
```

### With Persistent Queue

```typescript
import { initSyncStateClient } from "rwsdk/use-sync-state";
import { IndexedDBQueue } from "rwsdk/use-sync-state/queues";

initSyncStateClient({
  queue: new IndexedDBQueue(),
});

const [count, setCount] = useSyncedState(0, "counter");
```

Pending operations survive page reloads and sync when the user returns.

### Global Connection Indicator

```typescript
const { status } = useSyncedStateStatus();

return (
  <StatusIndicator>
    {status === 'reconnecting' && '🔄 Reconnecting...'}
    {status === 'disconnected' && '📡 Offline'}
    {status === 'connected' && '✅ Online'}
  </StatusIndicator>
);
```

### Custom Queue Implementation

```typescript
class CustomQueue implements SyncStateQueue {
  // Implement interface methods
  // Could use Redis, custom backend, etc.
}

initSyncStateClient({
  queue: new CustomQueue(),
});
```

## Design Decisions

**Optimistic updates always succeed locally**: The UI never blocks on network operations. Users see immediate feedback, and sync happens in the background.

**Automatic retry with exponential backoff**: Transient failures resolve themselves without user intervention. The exponential backoff prevents overwhelming the server during outages.

**Separate status hook**: Keeps the primary API identical to `useState`. Components that don't care about sync status have zero overhead. Components that need monitoring opt in explicitly.

**Pluggable queue interface**: Users choose the tradeoff between simplicity and persistence. The default (in-memory) works out of the box. Production apps can opt into IndexedDB or SQLite for offline support.

**Last-write-wins conflict resolution**: When the queue flushes after reconnection, queued operations overwrite server state. This matches the optimistic update behavior and keeps the model simple. Future enhancements could add CRDTs for more sophisticated conflict resolution.

## Edge Cases

**Queue conflicts**: If the server value changed while offline, the queued operation overwrites it when flushed. This is consistent with the optimistic update model.

**Queue size limits**: The in-memory queue has no size limit (could grow unbounded). Persistent queues (IndexedDB, SQLite) have browser storage limits. Future work could add max queue size, LRU eviction, or exponential backoff for queue growth.

**Persistence hydration**: When using a persistent queue, pending operations from a previous session flush on the next page load after the WebSocket connects. There is no UI indication that operations are from a previous session.

**Multiple tabs**: The in-memory queue is per-tab. IndexedDB and SQLite queues are shared across tabs, which could lead to duplicate operations if multiple tabs flush simultaneously. Future work could add tab coordination or operation deduplication.

## Implementation Status

**Status**: Planned (not yet implemented)

This document describes the intended design. Implementation will add:

- Connection manager module
- Pluggable queue interface and built-in implementations
- Enhanced `useSyncedState` with retry logic
- `useSyncedStateStatus` hook
- Integration with existing WebSocket reconnection
- Tests for error scenarios, retry logic, and queue flushing
