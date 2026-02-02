# OpenDurableObjects

> Internally this is called "Project Sourdough" as a reference to our mood. Anger is a gift.

OpenDurableObjects is a local/self-hostable implementation of the [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) model, designed to run on **Bun** and **Node.js**.

It provides a compatible API for building stateful, distributed applications using the actor model, allowing you to run Durable Objects anywhere.

## Features

- **Standard API**: Drop-in compatible with Cloudflare's Durable Object API.
- **Persistence**: Built-in SQLite storage for Key-Value pairs, SQL queries, and Alarms.
- **Communication**, **RPC**: Efficient communication using Cap'n Web for calling methods on Durable Objects as if they were local.
- **Lifecycle**: Automatic management of object lifecycle including hibernation and wake-up.
- **WebSockets**: Full support for WebSocket API, including hibernation and broadcast capabilities.

## Usage

Define your Durable Object class just like you would for Cloudflare Workers:

```typescript
import { OpenDO } from "@redwoodjs/open-do";

export class MyObject extends OpenDO {
  async fetch(request: Request) {
    // URL routing
    const url = new URL(request.url);
    
    if (url.pathname === "/increment") {
      // Use the storage API (Key-Value or SQL)
      let val = await this.storage.get("counter") || 0;
      val++;
      await this.storage.put("counter", val);
      return new Response(val.toString());
    }

    return new Response("Hello from Project Sourdough!");
  }
  
  async alarm() {
    console.log("Scheduled alarm triggered!");
  }
}
```

### Instantiating and using the object

```typescript
import { Registry } from "@redwoodjs/open-do";
import { MyObject } from "./MyObject";

const registry = new Registry();
const id = "unique-instance-id";

// Get a stub to interact with the object
const stub = await registry.get(id, MyObject);

// Send a request
const response = await stub.fetch(new Request("http://localhost/increment"));
console.log(await response.text()); // "1"
```

## Documentation

For a detailed breakdown of supported features and API compatibility, please see the [Feature Matrix](docs/matrix.md).

## License

MIT
