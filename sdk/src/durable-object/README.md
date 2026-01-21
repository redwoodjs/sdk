# rwsdk/durable-object

A lightweight, type-safe wrapper for Cloudflare Durable Objects that dramatically reduces boilerplate while maintaining full control and flexibility.

## Why?

Writing Durable Objects typically requires extensive boilerplate:
- Manual class extension from `DurableObject`
- Repetitive state management patterns
- Verbose fetch routing and action handling
- WebSocket connection management
- Error handling and serialization

`defineDO` abstracts ~150+ lines of boilerplate down to a simple configuration object, while giving you complete control over your state, actions, and business logic.

## Features

- ✅ **Minimal API**: Define state and actions, get a fully-functional Durable Object
- ✅ **Type-safe**: Full TypeScript support with automatic type inference
- ✅ **Zero magic**: Predictable behavior with no hidden complexity
- ✅ **Full control**: Access to storage, ctx, env, and all DO primitives
- ✅ **WebSocket support**: Built-in session management and broadcasting
- ✅ **Alarms support**: Easy-to-configure scheduled tasks
- ✅ **Action routing**: HTTP endpoints automatically generated for each action
- ✅ **State sync**: Automatic persistence and real-time broadcasting

## Installation
```
pnpm add rwsdk
```

## Quick Start

### 1. Define your Durable Object
```typescript
// src/durable-objects/Counter.ts
import { defineDO } from 'rwsdk/durable-object';

export const Counter = defineDO({
  state: { 
    count: 0,
    lastUpdated: null as Date | null
  },
  actions: {
    increment() {
      this.setState({ 
        count: this.state.count + 1,
        lastUpdated: new Date()
      });
      return this.state.count;
    },
    decrement() {
      this.setState({ 
        count: this.state.count - 1,
        lastUpdated: new Date()
      });
      return this.state.count;
    },
    get() {
      return this.state.count;
    },
    reset() {
      this.setState({ count: 0, lastUpdated: null });
    }
  }
});
```

### 2. Export from your worker
```typescript
// src/worker.ts
export { Counter } from './durable-objects/Counter';
```

### 3. Configure in wrangler.jsonc
```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "COUNTER",
        "class_name": "Counter"
      }
    ]
  }
}
```

### 4. Use in your application
```typescript
// Server action
"use server";
import { env } from "cloudflare:workers";

export async function incrementCounter() {
  const id = env.COUNTER.idFromName('global-counter');
  const stub = env.COUNTER.get(id);
  
  const response = await stub.fetch(
    new Request('http://do/action/increment', {
      method: 'POST',
      body: JSON.stringify({ args: [] })
    })
  );
  
  const result = await response.json();
  return result.result;
}
```

## What You Get

When you use `defineDO`, you automatically get:

### HTTP Endpoints

- `POST /action/{actionName}` - Execute any action
  - Body: `{ args: [...] }`
  - Response: `{ success: true, result: ... }` or `{ success: false, error: ... }`
- `GET /state` - Retrieve current state
  - Response: `{ state: {...} }`

### WebSocket Support
```typescript
const ws = new WebSocket('wss://your-worker.dev/');
// Automatically receives state updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'STATE') {
    console.log('New state:', data.state);
  }
};
```

### Built-in Methods

All actions receive a rich context object:
```typescript
actions: {
  myAction() {
    // Access state
    this.state.count;
    
    // Update state (persists + broadcasts)
    this.setState({ count: 5 });
    
    // Broadcast custom messages
    this.broadcast({ type: 'CUSTOM', data: 'hello' });
    
    // Call other actions
    await this.call('otherAction', arg1, arg2);
    
    // Access environment
    this.env.MY_KV;
    this.db; // If using rwsdk db
    
    // Access DO primitives
    this.ctx.storage;
    this.ctx.waitUntil(...);
    
    // WebSocket sessions
    this.sessions; // Set<WebSocket>
  }
}
```

## Advanced Features

### Alarms
```typescript
export const Scheduler = defineDO({
  state: { 
    nextRun: null as Date | null 
  },
  actions: {
    scheduleTask(delayMs: number) {
      const nextRun = new Date(Date.now() + delayMs);
      this.setState({ nextRun });
      this.ctx.storage.setAlarm(nextRun);
      this.ctx.storage.put('currentAlarm', 'dailyCleanup');
    }
  },
  alarms: {
    dailyCleanup() {
      console.log('Running scheduled cleanup...');
      this.setState({ nextRun: null });
      // Perform cleanup logic
    }
  }
});
```

### Function-based State Initialization
```typescript
export const SessionManager = defineDO({
  state: () => ({
    sessionId: crypto.randomUUID(),
    createdAt: new Date(),
    users: []
  }),
  actions: {
    addUser(name: string) {
      this.setState({ 
        users: [...this.state.users, name] 
      });
    }
  }
});
```

### Calling Actions from Other Actions
```typescript
export const GameRoom = defineDO({
  state: { 
    players: [],
    scores: {} 
  },
  actions: {
    addPlayer(name: string) {
      this.setState({ 
        players: [...this.state.players, name] 
      });
      // Initialize score by calling another action
      await this.call('updateScore', name, 0);
    },
    updateScore(player: string, points: number) {
      this.setState({
        scores: { ...this.state.scores, [player]: points }
      });
    }
  }
});
```

## Code Comparison

### Without `defineDO` (~150 lines)
```typescript
import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  state: { count: number };
  sessions = new Set<WebSocket>();
  
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get('state');
      this.state = stored || { count: 0 };
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket();
    }
    
    if (url.pathname === '/action/increment') {
      return this.increment();
    }
    
    if (url.pathname === '/action/get') {
      return this.get();
    }
    
    if (url.pathname === '/state') {
      return Response.json({ state: this.state });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async increment(): Promise<Response> {
    try {
      this.state = { count: this.state.count + 1 };
      await this.ctx.storage.put('state', this.state);
      this.broadcast({ type: 'STATE', state: this.state });
      return Response.json({ success: true, result: this.state.count });
    } catch (error: any) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }
  
  async get(): Promise<Response> {
    try {
      return Response.json({ success: true, result: this.state.count });
    } catch (error: any) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
  }
  
  broadcast(message: any) {
    const json = JSON.stringify(message);
    this.sessions.forEach(ws => {
      try {
        ws.send(json);
      } catch {
        this.sessions.delete(ws);
      }
    });
  }
  
  handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    this.sessions.add(server);
    server.accept();
    server.send(JSON.stringify({ type: 'STATE', state: this.state }));
    
    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });
    
    return new Response(null, { status: 101, webSocket: client });
  }
}
```

### With `defineDO` (~15 lines)
```typescript
import { defineDO } from 'rwsdk/durable-object';

export const Counter = defineDO({
  state: { count: 0 },
  actions: {
    increment() {
      this.setState({ count: this.state.count + 1 });
      return this.state.count;
    },
    get() {
      return this.state.count;
    }
  }
});
```

**Result**: 90% less code, same functionality, better maintainability.

## Testing

### Unit Tests
```typescript
import { defineDO } from 'rwsdk/durable-object';
import { describe, expect, it, vi, beforeEach } from "vitest";

describe('Counter', () => {
  let mockState: any;
  let mockEnv: any;

  beforeEach(() => {
    mockState = {
      storage: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      },
      blockConcurrencyWhile: vi.fn((fn: () => Promise<void>) => fn()),
      id: {},
      waitUntil: vi.fn(),
    };
    mockEnv = { db: {} };
  });

  it('increments counter', async () => {
    const Counter = defineDO({
      state: { count: 0 },
      actions: {
        increment() {
          this.setState({ count: this.state.count + 1 });
          return this.state.count;
        }
      }
    });

    const instance = new (Counter as any)(mockState, mockEnv);
    const initFn = (mockState.blockConcurrencyWhile as any).mock.calls[0][0];
    await initFn();
    
    const request = new Request('http://test/action/increment', { 
      method: 'POST',
      body: JSON.stringify({ args: [] })
    });
    const response = await instance.fetch(request);
    
    expect(instance.state.count).toBe(1);
  });
});
```

### Local Development

Durable Objects work automatically in local development with rwsdk:
```bash
pnpm dev
```

State persists during the dev session and resets on restart.

## Type Safety

Full TypeScript support with automatic inference:
```typescript
const GameRoom = defineDO({
  state: { 
    players: [] as string[],
    isStarted: false 
  },
  actions: {
    addPlayer(name: string) {
      // ✅ this.state.players is typed as string[]
      // ✅ this.state.isStarted is typed as boolean
      this.setState({ 
        players: [...this.state.players, name] 
      });
    }
  }
});

// Types are automatically inferred
type GameState = typeof GameRoom.state; // { players: string[], isStarted: boolean }
```

## API Reference

### `defineDO<TState, TActions, TAlarms>(config)`

#### Config

- **`state`**: Initial state object or function returning initial state
- **`actions`**: Object of action functions
- **`alarms`** (optional): Object of alarm handler functions

#### Context (available as `this` in actions/alarms)

- **`state`**: Current state object
- **`setState(partial)`**: Update state (merges, persists, broadcasts)
- **`broadcast(message)`**: Send message to all WebSocket sessions
- **`call(actionName, ...args)`**: Call another action
- **`env`**: Cloudflare environment bindings
- **`db`**: rwsdk database instance (if configured)
- **`sessions`**: `Set<WebSocket>` of active connections
- **`ctx`**: `DurableObjectState` for low-level access

## Best Practices

1. **Keep actions focused**: Each action should do one thing well
2. **Return values**: Actions can return values that will be serialized in the response
3. **Use setState for updates**: Always use `this.setState()` to ensure persistence and broadcasting
4. **Leverage call()**: Reuse logic by calling other actions
5. **Handle errors**: Wrap complex logic in try/catch within actions
6. **Unique IDs**: Use meaningful, unique ID strategies (`idFromName` vs `idFromString`)

## License

MIT