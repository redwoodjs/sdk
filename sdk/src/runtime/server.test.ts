import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverQuery, serverAction } from "./server";

vi.mock("./requestInfo/worker", () => ({
  requestInfo: {
    request: new Request("http://localhost"),
    ctx: {},
  },
}));

/**
 * This helper validates the server wrapper contract, not browser behavior.
 *
 * `serverQuery`/`serverAction` throw `Response` values to short-circuit.
 * Later in the real request pipeline, the runtime catches that thrown response
 * (in `rscActionHandler`), normalizes it, and sends metadata to the client.
 * The client then applies redirect behavior only for `3xx + location`.
 */
const getThrownResponse = async (
  run: () => Promise<unknown>,
): Promise<Response | any> => {
  try {
    const result = await run();
    if (
      typeof result === "object" &&
      result !== null &&
      "__rw_action_response" in result
    ) {
      return result;
    }
    throw new Error("Expected a Response to be thrown or redirect metadata");
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
};

describe("serverQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws redirect response returned by mainFn", async () => {
    const query = serverQuery(async () =>
      Response.redirect("http://localhost/login", 303),
    );

    const response = await getThrownResponse(() => query());
    expect(response.__rw_action_response.status).toBe(303);
    expect(response.__rw_action_response.headers.location).toBe(
      "http://localhost/login",
    );
  });

  it("throws non-redirect response returned by mainFn", async () => {
    const query = serverQuery(async () => {
      return new Response("unauthorized", {
        status: 401,
        statusText: "Unauthorized",
        headers: {
          "x-reason": "auth",
        },
      });
    });

    const response = await getThrownResponse(() => query());
    expect(response.__rw_action_response.status).toBe(401);
    expect(response.__rw_action_response.statusText).toBe("Unauthorized");
    expect(response.__rw_action_response.headers["x-reason"]).toBe("auth");
  });

  it("throws response returned by an interruptor and skips mainFn", async () => {
    const mainFn = vi.fn(async () => "main");
    const query = serverQuery([
      async () => Response.redirect("http://localhost/login", 303),
      mainFn,
    ]);

    const response = await getThrownResponse(() => query());
    expect(response.__rw_action_response.status).toBe(303);
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("returns value from an interruptor and skips mainFn", async () => {
    const mainFn = vi.fn(async () => "main");
    const query = serverQuery([async () => "from-interruptor", mainFn]);

    const result = await query();
    expect(result).toBe("from-interruptor");
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("allows interruptors to throw Response values", async () => {
    const mainFn = vi.fn(async () => "main");
    const query = serverQuery([
      async () => {
        throw Response.redirect("http://localhost/login", 303);
      },
      mainFn,
    ]);

    const response = await getThrownResponse(() => query());
    expect(response.status).toBe(303);
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("continues when an interruptor returns void", async () => {
    const mainFn = vi.fn(async () => "done");
    const query = serverQuery([async () => undefined, mainFn]);

    const result = await query();
    expect(result).toBe("done");
    expect(mainFn).toHaveBeenCalledTimes(1);
  });
});

describe("serverAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws redirect response returned by mainFn", async () => {
    const action = serverAction(async () =>
      Response.redirect("http://localhost/login", 303),
    );

    const response = await getThrownResponse(() => action());
    expect(response.__rw_action_response.status).toBe(303);
    expect(response.__rw_action_response.headers.location).toBe(
      "http://localhost/login",
    );
  });

  it("throws non-redirect response returned by mainFn", async () => {
    const action = serverAction(async () => {
      return new Response("conflict", {
        status: 409,
        statusText: "Conflict",
        headers: {
          "x-reason": "duplicate",
        },
      });
    });

    const response = await getThrownResponse(() => action());
    expect(response.__rw_action_response.status).toBe(409);
    expect(response.__rw_action_response.statusText).toBe("Conflict");
    expect(response.__rw_action_response.headers["x-reason"]).toBe("duplicate");
  });

  it("throws response returned by an interruptor and skips mainFn", async () => {
    const mainFn = vi.fn(async () => "main");
    const action = serverAction([
      async () => Response.redirect("http://localhost/login", 303),
      mainFn,
    ]);

    const response = await getThrownResponse(() => action());
    expect(response.__rw_action_response.status).toBe(303);
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("returns value from an interruptor and skips mainFn", async () => {
    const mainFn = vi.fn(async () => "main");
    const action = serverAction([async () => "from-interruptor", mainFn]);

    const result = await action();
    expect(result).toBe("from-interruptor");
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("allows interruptors to throw Response values", async () => {
    const mainFn = vi.fn(async () => "main");
    const action = serverAction([
      async () => {
        throw Response.redirect("http://localhost/login", 303);
      },
      mainFn,
    ]);

    const response = await getThrownResponse(() => action());
    expect(response.status).toBe(303);
    expect(mainFn).not.toHaveBeenCalled();
  });

  it("continues when an interruptor returns void", async () => {
    const mainFn = vi.fn(async () => "done");
    const action = serverAction([async () => undefined, mainFn]);

    const result = await action();
    expect(result).toBe("done");
    expect(mainFn).toHaveBeenCalledTimes(1);
  });
});
