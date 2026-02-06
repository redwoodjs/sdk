import { describe, expect, it } from "vitest";
import { normalizeActionResult } from "./normalizeActionResult";

describe("normalizeActionResult", () => {
  it("serializes response status, statusText and headers", () => {
    const response = new Response(null, {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        Location: "/login",
        "x-reason": "auth",
      },
    });

    expect(normalizeActionResult(response)).toEqual({
      __rw_action_response: {
        status: 401,
        statusText: "Unauthorized",
        headers: {
          location: "/login",
          "x-reason": "auth",
        },
      },
    });
  });

  it("always includes a location key", () => {
    const response = new Response(null, { status: 500 });

    expect(normalizeActionResult(response)).toEqual({
      __rw_action_response: {
        status: 500,
        statusText: "",
        headers: {
          location: null,
        },
      },
    });
  });
});
