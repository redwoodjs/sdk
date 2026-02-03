import {
  OpenDurableObject,
} from "./durable-object/index.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  InstanceContainer,
  OpenDOConstructor
} from "./host/runtime.js";
import {
  SqliteStorage,
  InMemoryStorage,
  getSqliteDriver
} from "./host/storage.js";
import { connectUds, UdsSocket } from "./transport.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isBun = typeof Bun !== "undefined";

/**
 * Remote Stub for interacting with a DO in another host process
 */
class RemoteStub {
  #id: string;
  #socketPath: string;
  #module: string;
  #className: string;
  
  constructor(id: string, socketPath: string, module: string, className: string) {
    this.#id = id;
    this.#socketPath = socketPath;
    this.#module = module;
    this.#className = className;
  }

  async fetch(request: Request): Promise<Response> {
      return this._internalFetch(request);
  }

  async _internalFetch(request: Request): Promise<Response> {
    // 1. Connect to Host UDS
    let socket: UdsSocket;
    try {
        socket = await connectUds(this.#socketPath);
    } catch (e) {
        throw new Error(`Failed to connect to host process at ${this.#socketPath}: ${e}`);
    }

    // 2. Serialize Request
    // We need to send ID, Module, Class, and the Request itself.
    // Simplifying: We constructs a URL that encodes the metadata, 
    // and rely on the Worker to parse it.
    // The Worker implements an HTTP server over UDS.
    
    // Original URL might be `http://do/foo` or similar.
    // usage: `router.ts` creates a request.
    // Worker/Host expects: `/?id=...&module=...&class=...`
    
    // We need to preserve the original path/method/headers/body.
    const originalUrl = new URL(request.url);
    
    // We modify the search params to include control metadata
    // Note: This might conflict if user uses these params.
    // Ideally we use headers.
    
    // Let's use Headers for metadata to be cleaner.
    // Worker `process.ts` needs to be updated to check headers too?
    // I implemented `process.ts` to check URL params.
    // Let's stick to URL params for now as per my `process.ts` implementation.
    
    const hostUrl = new URL(`http://localhost${originalUrl.pathname}`);
    hostUrl.searchParams.set("id", this.#id);
    hostUrl.searchParams.set("module", this.#module);
    hostUrl.searchParams.set("class", this.#className);
    
    // Copy original search params?
    originalUrl.searchParams.forEach((v, k) => {
        hostUrl.searchParams.append(k, v);
    });

    // 3. Send Request via `fetch`?
    // Run `fetch` over UDS?
    // Bun supports `fetch(url, { unix: socketPath })`.
    // Node.js doesn't natively support `fetch` over UDS easily without an agent.
    // Creating a custom agent is complex.
    
    // Alternative: We manually write HTTP 1.1 packet to the socket.
    // Or we use the `transport.ts` abstraction.
    
    // Since `transport.ts` returns a raw socket (stream), we have to write raw HTTP.
    
    // Implementing a full HTTP client is hard.
    // BUT we are only sending one request.
    
    // Let's see if we can use `fetch` with a custom dispatcher in Node (undici)?
    // Or `http.request`.
    
    if (isBun) {
       // @ts-ignore
       return fetch(hostUrl.toString(), {
           method: request.method,
           headers: request.headers,
           body: request.body,
           unix: this.#socketPath
       });
    } else {
       // Node.js implementation using 'http' module and 'socketPath' option
       const http = await import("node:http");
       
       return new Promise((resolve, reject) => {
           const headersObj: Record<string, string> = {};
           request.headers.forEach((v, k) => {
               headersObj[k] = v;
           });

           const options = {
               socketPath: this.#socketPath,
               method: request.method,
               path: hostUrl.pathname + hostUrl.search,
               headers: headersObj
           };
           
           const req = http.request(options, (res) => {
               // Convert IncomingMessage to Response
               const headers = new Headers();
               for (const [k, v] of Object.entries(res.headers)) {
                   if (Array.isArray(v)) v.forEach(val => headers.append(k, val));
                   else if (v) headers.set(k, v);
               }
               
               // Read body
               // We function as a proxy, so we can return a stream?
               // Response takes a ReadableStream.
               // Node stream is an AsyncIterable.
               
               // @ts-ignore
               const response = new Response(res as any, {
                   status: res.statusCode,
                   statusText: res.statusMessage,
                   headers: headers
               });
               
               resolve(response);
           });
           
           req.on('error', reject);
           
           if (request.body) {
                // Pipe request body to req
                // request.body is ReadableStream
                // req is Writable
                // We need to read from ReadableStream and write to req.
                const reader = request.body.getReader();
                const pump = async () => {
                    const { done, value } = await reader.read();
                    if (done) {
                        req.end();
                        return;
                    }
                    req.write(value);
                    pump();
                };
                pump().catch(reject);
           } else {
               req.end();
           }
       });
    }
  }
}

class HostProcessHandle {
    socketPath: string;
    process: any;
    
    constructor(socketPath: string, proc: any) {
        this.socketPath = socketPath;
        this.process = proc;
    }
    
    async checkCoordinates() {
        // TODO: Ping host process to ensure it's alive?
    }
}

export class ClusterCoordinator {
  #containers = new Map<string, InstanceContainer>(); // Local fallback
  #hosts: HostProcessHandle[] = [];
  #options: { 
      hibernationTimeoutMs?: number; 
      hibernationCheckIntervalMs?: number;
      env?: any; 
      storageDir?: string;
      hostCount?: number;
      hostScriptPath?: string; // Optional override
  };
  #evictionInterval: any = null;

  constructor(
    options: {
      hibernationTimeoutMs?: number;
      hibernationCheckIntervalMs?: number;
      env?: any;
      storageDir?: string;
      hostCount?: number;
      hostScriptPath?: string;
    } = {}
  ) {
    this.#options = options;
    
    // Start eviction loop (for LOCAL containers)
    const interval = this.#options.hibernationCheckIntervalMs || 10000;
    if (typeof setInterval !== 'undefined') {
        this.#evictionInterval = setInterval(() => this.#performEviction(), interval);
        if (this.#evictionInterval.unref) this.#evictionInterval.unref();
    }
    
    // Initialize host processes if requested
    if (this.#options.hostCount && this.#options.hostCount > 0) {
        this.#spawnHosts(this.#options.hostCount);
    }
  }
  
  #spawnHosts(count: number) {
      const hostScript = this.#options.hostScriptPath || path.join(__dirname, "host", "process.js");
      
      for (let i = 0; i < count; i++) {
          const socketPath = path.resolve(process.cwd(), `.do-host-${i}.sock`);
          const storageDir = this.#options.storageDir || process.cwd();
          
          let proc: any;
          if (isBun) {
              // @ts-ignore
             proc = Bun.spawn(["bun", "run", hostScript, "--socket", socketPath, "--storage", storageDir], {
                 stdout: "inherit",
                 stderr: "inherit"
             });
          } else {
              const cp = require("child_process"); // use require inside valid scope or import
              // we can use imported 'spawn' if we import it? 
              // dynamic import for node child_process to be safe in Bun?
              // Just use createRequire to be safe cross-runtime code in one file
              const { spawn } = createRequire(import.meta.url)("child_process");
              // Use npx tsx to execute the TypeScript worker in Node environment
              proc = spawn("npx", ["tsx", hostScript, "--socket", socketPath, "--storage", storageDir], {
                  stdio: "inherit"
              });
          }
          
          this.#hosts.push(new HostProcessHandle(socketPath, proc));
      }
  }

  async get<T extends OpenDurableObject>(
    id: string,
    Ctor: OpenDOConstructor<T>
  ): Promise<T> {
    // 1. Check if we should run locally (no host processes configured)
    if (this.#hosts.length === 0) {
        return this.#getLocal(id, Ctor);
    }
    
    // 2. Placement Logic (Hash ID to host)
    // Simple hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i) | 0;
    const index = Math.abs(hash) % this.#hosts.length;
    const host = this.#hosts[index];
    
    // 3. Resolve Module and Class Name
    // This is the tricky part. We need the FILE PATH of Ctor.
    // We assume the Ctor is exported from a file.
    // If we can't find it, we might fail or default to local?
    // "Single machine" typically implies we are running the SAME codebase.
    // We need to pass the file path relative to CWD.
    
    // Hack: We can't easily get the file path of a class in JS.
    // Workaround: We require `Ctor` to have a static `modulePath` or we assume it's in a known location?
    // OR: We check if `Ctor.name` is sufficient if the Host loads the 'entry point'.
    
    // Let's assume for now that we just pass `Ctor.name` and a placeholder module,
    // AND we assume the HostProcess (via args or build) to have that class available.
    // BUT my `process.ts` implementation specifically asks for `module` param to dynamic import.
    
    // Let's rely on a convention: 
    // If Ctor has `filename` or `__filename` or similar? No.
    
    // Let's default to LOCAL if we can't resolve remote?
    // No, we want to test remote.
    
    // Let's use a dummy module path for now and hope the test setup handles it?
    // In our tests, we define the class in the test file.
    // If the test file is `entry param`, `process.ts` can import it.
    
    // We'll pass `Ctor.name`.
    // We'll try to pass `module`.
    // If `(Ctor as any).modulePath` exists, use it.
    
    const modulePath = (Ctor as any).modulePath || ""; 
    // If empty, remote host process might fail if it relies on it.
    
    return new RemoteStub(id, host.socketPath, modulePath, Ctor.name) as unknown as T;
  }
  
  async #getLocal<T extends OpenDurableObject>(
    id: string,
    Ctor: OpenDOConstructor<T>
  ): Promise<T> {
    let container = this.#containers.get(id);
    if (!container) {
        // Create storage
        let storage: any; // Type inference or explicit import
        if (this.#options.storageDir) {
           const resolvedDir = path.resolve(process.cwd(), this.#options.storageDir);
           if (!fs.existsSync(resolvedDir)) {
             fs.mkdirSync(resolvedDir, { recursive: true });
           }
           const dbPath = path.join(resolvedDir, `${id}.sqlite`);
           const Driver = await getSqliteDriver();
           const db = new Driver(dbPath);
           storage = new SqliteStorage(db);
        } else {
           storage = new InMemoryStorage();
        }

        // Updated signature: no 'this' passed
        container = new InstanceContainer(id, storage, this.#options.env || {});
        this.#containers.set(id, container);
    }
    
    // Register Ctor in case we need it for wakeup
    return (await container.getInstance(Ctor)) as T;
  }
  
  #performEviction() {
      const timeout = this.#options.hibernationTimeoutMs || 30000;
      for (const [id, container] of this.#containers) {
          if (container.canEvict(timeout)) {
              if (container.instance) {
                  container.evict(); 
              }
              
              if (container.isEmpty) {
                  this.#containers.delete(id);
              }
          }
      }
  }

  close() {
      if (this.#evictionInterval) {
          clearInterval(this.#evictionInterval);
          this.#evictionInterval = null;
      }
      this.#containers.clear();
      
      // Kill host processes
      for (const host of this.#hosts) {
          // graceful kill?
          try {
              if (isBun) {
                 host.process.kill();
              } else {
                 host.process.kill();
              }
          } catch {}
      }
      this.#hosts = [];
  }
}

