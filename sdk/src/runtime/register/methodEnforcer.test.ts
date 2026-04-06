import { describe, expect, it, vi } from "vitest";
import { rscActionHandler, type RscActionHandlerDeps } from "./methodEnforcer";

function createDeps(
  action: Function,
): RscActionHandlerDeps {
  return {
    getServerModuleExport: vi.fn().mockResolvedValue(action),
    decodeReply: vi.fn().mockResolvedValue([]),
  };
}

function makeRequest(
  url: string,
  method: string,
  body?: string,
): Request {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.body = body;
    init.headers = { "content-type": "application/json" };
  }

  return new Request(url, init);
}

const ACTION_URL =
  "https://app.test/page?__rsc_action_id=%2Factions.tsx%23doThing";

describe("rscActionHandler method enforcement", () => {
  it("rejects GET for an action with method POST", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "GET");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects POST for an action with method GET", async () => {
    const action = Object.assign(vi.fn(), { method: "GET" });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "POST", "[]");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET");
    expect(action).not.toHaveBeenCalled();
  });

  it("allows POST for an action with method POST", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("ok"), {
      method: "POST",
    });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "POST", "[]");

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("ok");
    expect(action).toHaveBeenCalled();
  });

  it("allows GET for an action with method GET", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("data"), {
      method: "GET",
    });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL + "&args=%5B%5D", "GET");

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("data");
    expect(action).toHaveBeenCalled();
  });

  it("allows any method for actions without .method property", async () => {
    const action = vi.fn().mockReturnValue("ok");
    const deps = createDeps(action);

    const getReq = makeRequest(ACTION_URL, "GET");
    const getResult = await rscActionHandler(getReq, deps);
    expect(getResult).toBe("ok");

    const postReq = makeRequest(ACTION_URL, "POST", "[]");
    const postResult = await rscActionHandler(postReq, deps);
    expect(postResult).toBe("ok");
  });

  it("includes allowed methods in 405 response body", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "GET");

    const result = (await rscActionHandler(req, deps)) as Response;

    const body = await result.text();
    expect(body).toContain("Method GET is not allowed");
    expect(body).toContain("Allowed: POST");
  });

  it("allows through when .method is not a string", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("ok"), {
      method: 42,
    });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "GET");

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("ok");
    expect(action).toHaveBeenCalled();
  });

  it("throws when action is not a function", async () => {
    const deps: RscActionHandlerDeps = {
      getServerModuleExport: vi.fn().mockResolvedValue("not-a-function"),
      decodeReply: vi.fn(),
    };
    const req = makeRequest(ACTION_URL, "GET");

    await expect(rscActionHandler(req, deps)).rejects.toThrow(
      "is not a function",
    );
  });

  it("parses GET args from query string", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("result"), {
      method: "GET",
    });
    const deps = createDeps(action);
    const req = makeRequest(
      ACTION_URL + '&args=%5B%22hello%22%2C%2042%5D',
      "GET",
    );

    await rscActionHandler(req, deps);

    expect(action).toHaveBeenCalledWith("hello", 42);
  });

  it("uses decodeReply for POST body", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("result"), {
      method: "POST",
    });
    const deps: RscActionHandlerDeps = {
      getServerModuleExport: vi.fn().mockResolvedValue(action),
      decodeReply: vi.fn().mockResolvedValue(["decoded-arg"]),
    };
    const req = makeRequest(ACTION_URL, "POST", "serialized-body");

    await rscActionHandler(req, deps);

    expect(deps.decodeReply).toHaveBeenCalledWith("serialized-body", null);
    expect(action).toHaveBeenCalledWith("decoded-arg");
  });
});
