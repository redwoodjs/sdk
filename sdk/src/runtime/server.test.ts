import { describe, expect, it, vi, beforeEach } from "vitest";

let mockRequestInfo: { request: Request; ctx: Record<string, any> };

vi.mock("./requestInfo/worker", () => ({
  get requestInfo() {
    return mockRequestInfo;
  },
}));

import {
  serverAction,
  serverQuery,
  registerServerFunctionWrap,
  __resetServerFunctionWrap,
} from "./server";

describe("registerServerFunctionWrap", () => {
  beforeEach(() => {
    __resetServerFunctionWrap();
    mockRequestInfo = {
      request: new Request("https://test.example/"),
      ctx: {},
    };
  });

  it("wraps serverAction handlers", async () => {
    const wrapSpy = vi.fn((fn, args, _type) => fn(...args));
    registerServerFunctionWrap(wrapSpy);

    const action = serverAction(async function createThing(name: string) {
      return `created ${name}`;
    });

    const result = await action("foo");

    expect(wrapSpy).toHaveBeenCalledOnce();
    expect(wrapSpy.mock.calls[0][2]).toBe("action");
    expect(result).toBe("created foo");
  });

  it("wraps serverQuery handlers", async () => {
    const wrapSpy = vi.fn((fn, args, _type) => fn(...args));
    registerServerFunctionWrap(wrapSpy);

    const query = serverQuery(async function getThings() {
      return [1, 2, 3];
    });

    const result = await query();

    expect(wrapSpy).toHaveBeenCalledOnce();
    expect(wrapSpy.mock.calls[0][2]).toBe("query");
    expect(result).toEqual([1, 2, 3]);
  });

  it("passes the main function and args to the wrapper", async () => {
    const wrapSpy = vi.fn((fn, args, _type) => fn(...args));
    registerServerFunctionWrap(wrapSpy);

    const action = serverAction(
      async function multiply(a: number, b: number) {
        return a * b;
      },
    );

    await action(3, 7);

    const [fn, args] = wrapSpy.mock.calls[0];
    expect(fn.name).toBe("multiply");
    expect(args).toEqual([3, 7]);
  });

  it("interruptors run outside the wrapper", async () => {
    const order: string[] = [];

    registerServerFunctionWrap((fn, args, _type) => {
      order.push("wrap:start");
      const result = fn(...args);
      order.push("wrap:end");
      return result;
    });

    const interruptor = async () => {
      order.push("interruptor");
    };

    const action = serverAction([
      interruptor,
      async function doWork() {
        order.push("handler");
        return "done";
      },
    ]);

    await action();

    expect(order).toEqual([
      "interruptor",
      "wrap:start",
      "handler",
      "wrap:end",
    ]);
  });

  it("wrapper is not called when an interruptor short-circuits", async () => {
    const wrapSpy = vi.fn((fn, args, _type) => fn(...args));
    registerServerFunctionWrap(wrapSpy);

    const action = serverAction([
      async () => new Response("blocked", { status: 403 }),
      async function neverCalled() {
        return "nope";
      },
    ]);

    const result = await action();

    expect(wrapSpy).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
  });

  it("replaces the wrapper if called more than once", async () => {
    const first = vi.fn((fn, args, _type) => fn(...args));
    const second = vi.fn((fn, args, _type) => fn(...args));

    registerServerFunctionWrap(first);
    registerServerFunctionWrap(second);

    const action = serverAction(async function run() {
      return "ok";
    });
    await action();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("without registration, handlers work normally", async () => {
    const action = serverAction(async function echo(msg: string) {
      return msg;
    });

    const result = await action("hello");

    expect(result).toBe("hello");
  });

  it("wrapper can transform the return value", async () => {
    registerServerFunctionWrap(async (fn, args, _type) => {
      const result = await fn(...args);
      return { wrapped: true, result };
    });

    const action = serverAction(async function getValue() {
      return 42;
    });

    const result = await action();

    expect(result).toEqual({ wrapped: true, result: 42 });
  });

  it("works with array-style serverAction (interruptors + handler)", async () => {
    const wrapSpy = vi.fn((fn, args, _type) => fn(...args));
    registerServerFunctionWrap(wrapSpy);

    const action = serverAction([
      async ({ ctx }: any) => {
        ctx.authed = true;
      },
      async function save(data: string) {
        return `saved ${data}`;
      },
    ]);

    const result = await action("test");

    expect(result).toBe("saved test");
    expect(wrapSpy).toHaveBeenCalledOnce();
    const [fn] = wrapSpy.mock.calls[0];
    expect(fn.name).toBe("save");
  });
});
