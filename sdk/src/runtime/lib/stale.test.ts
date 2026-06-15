import { describe, expect, it } from "vitest";
import {
  CLIENT_VERSION_HEADER,
  STALE_CLIENT_ERROR_MESSAGE,
  StaleClientError,
  buildStaleEvent,
  createStaleReloadResponse,
  isStaleClientError,
  isStaleRequest,
} from "./stale.js";

describe("stale helpers", () => {
  it("does not mark a request stale when the client version is missing", () => {
    const request = new Request("http://localhost/");

    expect(isStaleRequest(request, "core", "new-build")).toBe(false);
  });

  it("returns true when the request header version mismatches", () => {
    const request = new Request("http://localhost/__rsc", {
      headers: {
        [CLIENT_VERSION_HEADER]: "old-build",
      },
    });

    expect(isStaleRequest(request, "core", "new-build")).toBe(true);

    const event = buildStaleEvent(request, "core", "new-build");
    expect(event.reason).toBe("client-version-mismatch");
    expect(event.clientVersion).toBe("old-build");
    expect(event.currentVersion).toBe("new-build");
  });

  it("returns a reload response for stale requests", () => {
    const response = createStaleReloadResponse();

    expect(response.status).toBe(409);
    expect(response.headers.get("x-rwsdk-stale")).toBe("reload");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("identifies StaleClientError instances by message", () => {
    const error = new StaleClientError();

    expect(isStaleClientError(error)).toBe(true);
    expect(isStaleClientError(new Error(STALE_CLIENT_ERROR_MESSAGE))).toBe(
      true,
    );
    expect(isStaleClientError(new Error("other"))).toBe(false);
    expect(isStaleClientError("string")).toBe(false);
  });
});
