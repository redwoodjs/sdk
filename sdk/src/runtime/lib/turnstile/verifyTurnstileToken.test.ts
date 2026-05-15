import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./verifyTurnstileToken";

describe("verifyTurnstileToken", () => {
  it("should return true for a successful verification", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await verifyTurnstileToken({
      token: "valid-token",
      secretKey: "secret",
      fetchFn: mockFetch,
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.any(Object),
    );
  });

  it("should return false for a failed verification", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await verifyTurnstileToken({
      token: "invalid-token",
      secretKey: "secret",
      fetchFn: mockFetch,
    });

    expect(result).toBe(false);
  });

  it("should return false if the fetch call fails", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await verifyTurnstileToken({
      token: "any-token",
      secretKey: "secret",
      fetchFn: mockFetch,
    });

    expect(result).toBe(false);
  });

  it("should return false for a non-JSON response", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("not json", { status: 200 }));

    const result = await verifyTurnstileToken({
      token: "any-token",
      secretKey: "secret",
      fetchFn: mockFetch,
    });

    expect(result).toBe(false);
  });
});
