# Supported Feature Matrix

This document tracks the supported features of `open-do` compared to the official Cloudflare Durable Objects API.

## API Reference

Since `open-do` aims to maintain API compatibility with Cloudflare, the following official documentation serves as the primary reference:

- [**Durable Object State**](https://developers.cloudflare.com/durable-objects/api/state/) - `id`, `storage`, `blockConcurrencyWhile`, `waitUntil`.
- [**Storage API (KV)**](https://developers.cloudflare.com/durable-objects/api/kv-storage/) - `get`, `put`, `delete`, `list`.
- [**SQL API (SQLite)**](https://developers.cloudflare.com/durable-objects/api/sqlite-storage/) - `prepare`, `exec`, and statement methods.
- [**Alarms API**](https://developers.cloudflare.com/durable-objects/api/alarms/) - `setAlarm`, `getAlarm`.
- [**RPC Reference**](https://developers.cloudflare.com/workers/runtime-apis/rpc/) - Working with stubs and remote methods.

---

## Overview

| Feature Category | Implementation Status | Importance |
| :--- | :--- | :--- |
| **Storage (KV)** | ✅ Full | Critical |
| **Storage (SQL)** | ✅ Full | High |
| **Lifecycle & State** | 🟡 Partial | Critical |
| **Concurrency Control** | ✅ Serial | Critical |
| **RPC & Stubs** | ✅ Implemented | High |
| **Alarms** | ✅ Implemented | Medium |
| **WebSocket Hibernation** | 🟡 Partial | Medium |
| **Broadcast API** | ✅ Implemented | Medium |

---

## Storage API (Key-Value)

The Key-Value API provides transactional, strongly consistent storage for persistent data.

| Method | Description | Implementation |
| :--- | :--- | :--- |
| `get<T>(key: string \| string[])` | Get values for keys | ✅ |
| `put<T>(key: string \| entries)` | Store keys/values | ✅ |
| `delete(key: string \| string[])` | Delete keys | ✅ |
| `deleteAll()` | Delete all keys | ✅ |
| `list<T>(options)` | List keys with prefix/limit/startAfter | ✅ |
| `transaction<T>(callback)` | Run atomic transactions | ✅ |

### Code Sample
```typescript
await state.storage.put("my-key", { hello: "world" });
const val = await state.storage.get("my-key");
```

---

## Storage API (SQL)

The SQL API uses a private, co-located SQLite database for each object.

| Method | Description | Implementation |
| :--- | :--- | :--- |
| `sql.prepare(query)` | Prepare a statement | ✅ |
| `sql.exec(query)` | Execute raw SQL | ✅ |
| `sql.databaseSize` | Current size on disk | ✅ |
| `stmt.bind(...params)` | Bind parameters | ✅ |
| `stmt.first<T>()` | Get first row | ✅ |
| `stmt.all<T>()` | Get all rows | ✅ |
| `stmt.run()` | Run (insert/update) | ✅ |

### Code Sample
```typescript
const stmt = state.storage.sql.prepare("SELECT * FROM users WHERE id = ?");
const user = stmt.bind(1).first();
```

---

## Lifecycle & State

Management of the Durable Object's unique identity and internal state.

| Feature | Description | Implementation |
| :--- | :--- | :--- |
| `id` | Unique identifier for the object | ✅ |
| `blockConcurrencyWhile` | Block requests during setup | ✅ |
| `waitUntil` | Extend lifetime for background work | ✅ |
| `fetch` | The main entry point for requests | ✅ |

### Code Sample
```typescript
export class MyObject extends OpenDO {
  async fetch(request: Request) {
    this.ctx.waitUntil(this.doBackgroundWork());
    return new Response("Hello");
  }
}
```

---

## Alarms API

Allows Durable Objects to schedule future work.

| Method | Description | Implementation |
| :--- | :--- | :--- |
| `getAlarm()` | Get scheduled time | ✅ |
| `setAlarm(time)` | Schedule new alarm | ✅ |
| `deleteAlarm()` | Cancel alarm | ✅ |
| `alarm()` | The handler method | ✅ |

### Code Sample
```typescript
export class MyObject extends OpenDO {
  async fetch(request: Request) {
    await this.storage.setAlarm(Date.now() + 1000);
    return new Response("Scheduled");
  }

  async alarm() {
    console.log("Alarm triggered!");
  }
}
```

---

## RPC & Stubs

Enables calling methods on a Durable Object as if they were local JavaScript functions.

| Feature | Description | Implementation |
| :--- | :--- | :--- |
| `getStub(id)` | Create a proxy for the object | ✅ |
| `Proxy methods` | Calling methods triggers RPC | ✅ |
| `Serialization` | Binary via Cap'n Web | ✅ |

### Code Sample
```typescript
const stub = registry.getStub<MyObject>("some-id");
const result = await stub.myMethod("arg1");
```

---


---

## WebSocket API

Manage active WebSocket connections and broadcasting.

| Method | Description | Implementation |
| :--- | :--- | :--- |
| `state.acceptWebSocket(ws, tags)` | Track a socket | ✅ |
| `state.getWebSockets(tag)` | Get active sockets from memory | ✅ |
| `Hibernation` | Auto-wake and sleep | 🟡 (Simulated via keep-alive) |

### Code Sample
```typescript
export class MyObject extends OpenDO {
  async fetch(request: Request) {
    if (request.headers.get("Upgrade") === "websocket") {
       const pair = new WebSocketPair();
       const [client, server] = Object.values(pair);
       
       this.state.acceptWebSocket(server, ["room-1"]);
       return new Response(null, { status: 101, webSocket: client });
    }
  }

  broadcast(msg: string) {
    for (const ws of this.state.getWebSockets("room-1")) {
      ws.send(msg);
    }
  }
}
```

---

## Future Roadmap

These features are planned but not yet implemented in `open-do`:
- **WebSocket Hibernation**: True platform-level hibernation without memory overhead.
- **Improved Hibernation**: Better memory management for inactive objects.
