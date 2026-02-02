import { describe, it, expect, afterAll } from "vitest";
import { OpenDurableObjectRegistry } from "./registry.js";
import { SimpleDO } from "./fixtures/simple-do.js";
import path from "node:path";

// Manually attach module path for the test
// @ts-ignore
SimpleDO.modulePath = path.resolve(__dirname, "fixtures/simple-do.ts");

describe("Single Machine Process Model", () => {
  let registry: OpenDurableObjectRegistry;

  afterAll(() => {
    if (registry) registry.close();
  });

  it("should spawn a worker and route requests via UDS", async () => {
    registry = new OpenDurableObjectRegistry({
      workerCount: 1,
      // Use transient storage for test
      storageDir: path.resolve(process.cwd(), ".test-storage")
    });
    
    // Give workers a moment to start (though UDS connect retries might handle it, 
    // explicit wait helps in tests)
    await new Promise(r => setTimeout(r, 3000));

    const stub = await registry.get("test-id-1", SimpleDO);
    
    // We expect 'stub' to be a RemoteStub (casted to SimpleDO)
    // But since SimpleDO methods are not on RemoteStub, direct call like `stub.sayHello()` won't work 
    // UNLESS we use the Router or create a typed Proxy.
    
    // Wait, `RemoteStub` only has `_internalFetch`.
    // The `OpenDurableObject` defines `_internalFetch`.
    // BUT the user usually accesses methods via `connection.createStub` or assumes local usage?
    
    // If I use `registry.get`, in the OLD local model, I got the real instance.
    // In the NEW model, I get a RemoteStub.
    // `RemoteStub` does NOT have `sayHello`.
    
    // This highlights a design shift:
    // If we want transparent RPC, `registry.get` must return a Proxy.
    // OR, we must use `createStub` from `durable-object/rpc.ts` over the `RemoteStub`.
    
    // Verify Router Integration
    const { createOpenDurableObjectRouter } = await import("./router.js");
    const router = createOpenDurableObjectRouter(registry, SimpleDO);

    const req = new Request("http://localhost/sayHello?id=test-id-1", {
        method: "POST",
        body: JSON.stringify(["World"])
    });

    const res = await router(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toBe("Hello, World from SimpleDO");
  });
});
