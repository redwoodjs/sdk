import { describe, it, expect, vi } from "vitest";
import { serverQuery, serverAction } from "./server";

// Mock request info mostly because serverQuery might depend on it (though existing code suggests it uses it inside wrapper)
// The wrapper accesses `requestInfoBase` from `./requestInfo/worker`. We might need to mock that module.
// But `server.ts` imports `requestInfo` from `./requestInfo/worker`.

vi.mock("./requestInfo/worker", () => ({
  requestInfo: {
    request: new Request("http://localhost"),
    ctx: {},
  },
}));

describe("serverQuery", () => {
  it("throws Response when returned by mainFn", async () => {
    const response = new Response("ok");
    const query = serverQuery(async () => {
      return response;
    });

    try {
      await query();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBe(response);
    }
  });

  it("throws Response when returned by interruptor", async () => {
    const response = new Response("interrupt");
    const interruptor = async () => {
      return response;
    };
    
    const query = serverQuery([
      interruptor,
      async () => "main",
    ]);

    try {
      await query();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBe(response);
    }
  });

  it("returns normal value", async () => {
    const query = serverQuery(async () => {
      return "hello";
    });

    const result = await query();
    expect(result).toBe("hello");
  });
});

describe("serverAction", () => {
  it("throws Response when returned by mainFn", async () => {
    const response = new Response("ok action");
    const action = serverAction(async () => {
        return response;
    });

    try {
      await action();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBe(response);
    }
  });

  it("throws Response when returned by interruptor", async () => {
    const response = new Response("interrupt");
    const interruptor = async () => {
      return response;
    };
    
    const action = serverAction([
      interruptor,
      async () => "main",
    ]);

    try {
      await action();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBe(response);
    }
  });
});
