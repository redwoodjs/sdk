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
  extraHeaders?: Record<string, string>,
): Request {
  const init: RequestInit = { method };
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    init.body = body;
    headers["content-type"] = "application/json";
  }

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  if (Object.keys(headers).length > 0) {
    init.headers = headers;
  }

  return new Request(url, init);
}

const ACTION_URL =
  "https://app.test/page?__rsc_action_id=%2Factions.tsx%23doThing";

const SELF_ORIGIN = "https://app.test";

function postWithOrigin(origin: string | undefined): Request {
  const headers: Record<string, string> = {};
  if (origin !== undefined) {
    headers["Origin"] = origin;
  }
  return makeRequest(ACTION_URL, "POST", "[]", headers);
}

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
    const req = makeRequest(ACTION_URL, "POST", "[]", { Origin: SELF_ORIGIN });

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
    const req = makeRequest(ACTION_URL, "POST", "[]", { Origin: SELF_ORIGIN });

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

  it("defaults to POST for actions without .method property", async () => {
    const action = vi.fn().mockReturnValue("ok");
    const deps = createDeps(action);

    const postReq = makeRequest(ACTION_URL, "POST", "[]", {
      Origin: SELF_ORIGIN,
    });
    const postResult = await rscActionHandler(postReq, deps);
    expect(postResult).toBe("ok");
    expect(action).toHaveBeenCalled();
  });

  it("rejects GET for actions without .method property", async () => {
    const action = vi.fn();
    const deps = createDeps(action);

    const getReq = makeRequest(ACTION_URL, "GET");
    const getResult = await rscActionHandler(getReq, deps);
    expect(getResult).toBeInstanceOf(Response);
    expect((getResult as Response).status).toBe(405);
    expect(action).not.toHaveBeenCalled();
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

  it("rejects when .method is not a valid string", async () => {
    const action = Object.assign(vi.fn(), {
      method: 42,
    });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL, "GET");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(405);
    expect(action).not.toHaveBeenCalled();
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
    const req = makeRequest(ACTION_URL, "POST", "serialized-body", {
      Origin: SELF_ORIGIN,
    });

    await rscActionHandler(req, deps);

    expect(deps.decodeReply).toHaveBeenCalledWith("serialized-body", null);
    expect(action).toHaveBeenCalledWith("decoded-arg");
  });
});

describe("rscActionHandler origin enforcement", () => {
  it("allows POST whose Origin matches the request's own origin", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("ok"), {
      method: "POST",
    });
    const deps = createDeps(action);
    const req = postWithOrigin(SELF_ORIGIN);

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("ok");
    expect(action).toHaveBeenCalled();
  });

  it("rejects POST from a different origin with 403", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = postWithOrigin("https://evil.test");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects POST from a same-site sibling subdomain with 403", async () => {
    // context(justinvdm, 2026-04-20): The exact scenario in the advisory —
    // Origin sits under the same registrable domain so SameSite=Lax cookies
    // are attached, but the Origin header does not match the app's own origin.
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = postWithOrigin("https://evil.test.example");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects POST missing the Origin header with 403", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = postWithOrigin(undefined);

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("allows POST from an origin in the allowedOrigins list", async () => {
    const action = Object.assign(vi.fn().mockReturnValue("ok"), {
      method: "POST",
    });
    const deps: RscActionHandlerDeps = {
      ...createDeps(action),
      allowedOrigins: ["https://trusted.example"],
    };
    const req = postWithOrigin("https://trusted.example");

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("ok");
    expect(action).toHaveBeenCalled();
  });

  it("rejects POST from an origin not in the allowedOrigins list", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps: RscActionHandlerDeps = {
      ...createDeps(action),
      allowedOrigins: ["https://trusted.example"],
    };
    const req = postWithOrigin("https://not-trusted.example");

    const result = await rscActionHandler(req, deps);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });

  it("does not apply the origin check to GET (serverQuery) requests", async () => {
    // context(justinvdm, 2026-04-20): GET is expected to be idempotent and is
    // out of scope for the origin check. A top-level GET navigation from
    // another origin does not send an Origin header at all, so enforcing here
    // would reject legitimate navigations.
    const action = Object.assign(vi.fn().mockReturnValue("data"), {
      method: "GET",
    });
    const deps = createDeps(action);
    const req = makeRequest(ACTION_URL + "&args=%5B%5D", "GET");

    const result = await rscActionHandler(req, deps);

    expect(result).toBe("data");
    expect(action).toHaveBeenCalled();
  });

  it("runs origin check before invoking the action", async () => {
    const action = Object.assign(vi.fn(), { method: "POST" });
    const deps = createDeps(action);
    const req = postWithOrigin("https://evil.test");

    await rscActionHandler(req, deps);

    expect(deps.getServerModuleExport).not.toHaveBeenCalled();
    expect(deps.decodeReply).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });
});
