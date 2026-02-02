import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isBun = typeof Bun !== "undefined";

export interface UdsServer {
  close(): void | Promise<void>;
  address(): string | null;
}

export interface UdsSocket {
  write(data: Uint8Array): void | Promise<void>;
  end(): void | Promise<void>;
  on(event: "data", listener: (data: Uint8Array) => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  // Helper for async iteration or one-time read?
  // We'll stick to event-based for now to match Node/Bun streams commonality or wrap it.
}

type ConnectionHandler = (socket: UdsSocket) => void;

export async function createUdsServer(
  path: string,
  handler: ConnectionHandler
): Promise<UdsServer> {
  if (isBun) {
    // Bun Implementation
    // fs.unlinkSync(path) if exists? Bun.listen might handle it or throw.
    // Usually good practice to unlink.
    try {
        const fs = await import("node:fs"); 
        if (fs.existsSync(path)) fs.unlinkSync(path);
    } catch {}

    const server = Bun.listen({
      unix: path,
      socket: {
        data(socket, data) {
           // We need to map Bun's socket to our UdsSocket. 
           // But Bun reuses the socket object for callbacks.
           // We need to attach user metadata or look it up.
           // However, `createUdsServer` takes a handler that is called ONCE per connection.
           // Bun calls `open` once.
           // We can attach the "wrapper" to the socket.data.
           const wrapper = socket.data as any; // We'll define wrapper below
           if (wrapper) wrapper.emit("data", data);
        },
        open(socket) {
             const wrapper = new BunSocketWrapper(socket);
             socket.data = wrapper;
             handler(wrapper);
        },
        close(socket) {
            const wrapper = socket.data as any;
            if (wrapper) wrapper.emit("close");
        },
        error(socket, error) {
            const wrapper = socket.data as any;
            if (wrapper) wrapper.emit("error", error);
        },
      },
    });

    return {
        close: () => server.stop(),
        address: () => path
    };
  } else {
    // Node.js Implementation
    const net = require("node:net");
    const fs = require("node:fs");
    
    if (fs.existsSync(path)) {
        try { fs.unlinkSync(path); } catch {}
    }

    return new Promise((resolve, reject) => {
        const server = net.createServer((socket: any) => {
            handler(new NodeSocketWrapper(socket));
        });
        
        server.on("error", (err: any) => {
             // If we haven't resolved yet
             reject(err);
        });

        server.listen(path, () => {
            resolve({
                close: () => new Promise<void>(r => server.close(r)),
                address: () => path
            });
        });
    });
  }
}

export async function connectUds(path: string): Promise<UdsSocket> {
    if (isBun) {
        return new Promise((resolve, reject) => {
             // Bun.connect returns a promise but it resolves slightly differently?
             // Actually await Bun.connect returns the socket.
             // But we need to define the handlers *in* the connect call.
             // This makes "returning a generic socket" slightly tricky because 
             // we need to set up the 'data' listener LATER, but Bun wants it NOW.
             
             // Sol: create a wrapper that queues events until listeners are attached?
             // Or just expose `on`?
             
            const wrapper = new BunSocketWrapper(null); // Will set socket later
             
            Bun.connect({
                unix: path,
                socket: {
                    data(socket, data) {
                        wrapper.emit("data", data);
                    },
                    open(socket) {
                        wrapper.setSocket(socket);
                        resolve(wrapper);
                    },
                    close(socket) {
                        wrapper.emit("close");
                    },
                    error(socket, error) {
                        wrapper.emit("error", error);
                        reject(error); // if failing to connect
                    },
                }
            }).catch(reject);
        });
    } else {
        const net = require("node:net");
        return new Promise((resolve, reject) => {
            const socket = net.createConnection(path);
            const wrapper = new NodeSocketWrapper(socket);
            
            socket.on("connect", () => resolve(wrapper));
            socket.on("error", (err: any) => reject(err));
        });
    }
}

// --- Wrappers ---

class NodeSocketWrapper implements UdsSocket {
    #socket: any;
    
    constructor(socket: any) {
        this.#socket = socket;
    }
    
    write(data: Uint8Array) {
        this.#socket.write(data);
    }
    
    end() {
        this.#socket.end();
    }
    
    on(event: string, listener: (...args: any[]) => void) {
        this.#socket.on(event, listener);
    }
}

class BunSocketWrapper implements UdsSocket {
    #socket: any;
    #listeners = new Map<string, Set<Function>>();
    #bufferedData: Uint8Array[] = [];
    
    constructor(socket: any) {
        this.#socket = socket;
    }
    
    setSocket(socket: any) {
        this.#socket = socket;
        // Flush buffer if we had any writes pending? (Bun connect shouldn't need this often)
    }
    
    write(data: Uint8Array) {
        this.#socket?.write(data);
    }
    
    end() {
        this.#socket?.end(); // or close()
    }
    
    on(event: string, listener: Function) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event)!.add(listener);
    }
    
    emit(event: string, ...args: any[]) {
        const listeners = this.#listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                listener(...args);
            }
        }
    }
}
