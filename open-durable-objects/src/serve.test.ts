import { describe, it, expect, afterAll } from "vitest";
import { serve, Env } from "./serve.js";
import { OpenDurableObject, DurableObjectState } from "./durable-object/index.js";
import path from "node:path";

import fs from "node:fs";

class ServeTestDO extends OpenDurableObject {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/count") {
      let count = (await this.storage.get<number>("count")) || 0;
      await this.storage.put("count", ++count);
      return new Response(String(count));
    }
    return new Response("OK");
  }
}

describe("Serve API", () => {
  let coordinator: any;

  // Cleanup storage before tests
  const STORAGE_DIRS = [
      path.resolve(process.cwd(), ".serve-test-storage"),
      path.resolve(process.cwd(), ".serve-test-storage-2")
  ];
  const cleanup = () => {
      STORAGE_DIRS.forEach(dir => {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      });
  };
  
  // Clean before all tests
  // @ts-ignore
  if (typeof beforeAll !== 'undefined') beforeAll(cleanup);
  
  afterAll(() => {
    if (coordinator) {
      coordinator.close();
    }
    cleanup();
  });

  it("should initialize coordinator and bind DOs", async () => {
    // Mock the Bun.serve globally if not present (Node env)
    // or just rely on the fact that serve() returns the coordinator 
    // and setting up 'env' logic runs synchronously.
    
    // We want to test the 'fetch' handler we pass to serve, 
    // ensuring it receives a correct 'env'.
    
    let capturedEnv: Env | undefined;
    
    // Define the worker
    const worker = {
      fetch: (req: Request, env: Env) => {
        capturedEnv = env;
        return new Response("Worker Response");
      }
    };

    // start 'serve'
    // Note: We won't actually start a server port binding in test if strictly unit testing,
    // but the current implementation tries to.
    // However, in Node vitest, 'Bun' is undefined, so it skips actual serve but returns coordinator.
    // This allows us to verify the setup logic.
    
    coordinator = serve(worker, {
      hostCount: 0, // Local Fallback
      storageDir: path.resolve(process.cwd(), ".serve-test-storage"),
      durableObjects: {
        TEST_DO: ServeTestDO
      }
    });

    expect(coordinator).toBeDefined();
    
    // Simulate a request to the worker
    // The 'serve' function creates 'env' and passes it to worker.fetch INSIDE the server callback.
    // Since we can't easily trigger the internal server callback without mocking Bun.serve,
    // we might need to export a helper or refactor 'serve' to allow testing.
    // OR we can rely on the fact that 'serve' does specific things.
    
    // Actually, to test this strictly in Node Vitest without Bun, 
    // we need to access the 'env' construction logic.
    // But 'env' is created inside 'serve'.
    
    // Let's modify 'serve' slightly to allow returning the 'env' or 
    // expose the internal handler?
    // OR: We can mock global Bun.serve to capture the handler!
  });
  
  it("should produce a working stub from env binding", async () => {
      let serverHandler: any;
      
      // Mock Bun.serve
      // @ts-ignore
      globalThis.Bun = {
          serve: (options: any) => {
              serverHandler = options.fetch;
              return { stop: () => {} };
          }
      };
      
      const worker = {
          fetch: async (req: Request, env: Env) => {
              // Try to use the binding
              const id = env.TEST_DO.idFromName("counter-1");
              const stub = env.TEST_DO.get(id);
              return stub.fetch(req); // Should proxy to ServeTestDO
          }
      };
      
      coordinator = serve(worker, {
          hostCount: 0,
          storageDir: path.resolve(process.cwd(), ".serve-test-storage-2"),
          durableObjects: {
              TEST_DO: ServeTestDO
          }
      });
      
      expect(serverHandler).toBeDefined();
      
      // Execute the handler
      const req = new Request("http://localhost/count");
      const res = await serverHandler(req);
      const text = await res.text();
      
      expect(text).toBe("1");
      
      // Second call
      const res2 = await serverHandler(req);
      expect(await res2.text()).toBe("2");
  });
});
