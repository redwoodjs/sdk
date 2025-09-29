import { describe, expect, it } from "vitest";
import { validateUpgradeRequest } from "./validateUpgradeRequest";

describe("validateUpgradeRequest", () => {
  it("should return valid for a correct WebSocket upgrade request", () => {
    const request = new Request("http://localhost:8787/ws", {
      headers: {
        Upgrade: "websocket",
        Origin: "http://localhost:8787",
      },
    });
    const result = validateUpgradeRequest(request);
    expect(result.valid).toBe(true);
  });

  it("should return invalid if Upgrade header is not 'websocket'", async () => {
    const request = new Request("http://localhost:8787/ws", {
      headers: {
        Upgrade: "not-websocket",
        Origin: "http://localhost:8787",
      },
    });
    const result = validateUpgradeRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.response?.status).toBe(400);
      await expect(result.response?.text()).resolves.toBe("Expected WebSocket");
    }
  });

  it("should return invalid if Upgrade header is missing", () => {
    const request = new Request("http://localhost:8787/ws", {
      headers: {
        Origin: "http://localhost:8787",
      },
    });
    const result = validateUpgradeRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.response?.status).toBe(400);
    }
  });

  it("should return invalid if Origin header is missing", async () => {
    const request = new Request("http://localhost:8787/ws", {
      headers: {
        Upgrade: "websocket",
      },
    });
    const result = validateUpgradeRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.response?.status).toBe(403);
      await expect(result.response?.text()).resolves.toBe("Invalid origin");
    }
  });

  it("should return invalid if Origin does not match request URL", () => {
    const request = new Request("http://localhost:8787/ws", {
      headers: {
        Upgrade: "websocket",
        Origin: "http://another-domain.com",
      },
    });
    const result = validateUpgradeRequest(request);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.response?.status).toBe(403);
    }
  });
});
