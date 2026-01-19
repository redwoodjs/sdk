import { SELF } from "cloudflare:test";
import { expect, test } from "vitest";

test("GET / returns HTML", async () => {
  const res = await SELF.fetch("http://example.com/");
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toMatch(/<!doctype html/i);
});

test("GET / (home) contains starter content", async () => {
  const res = await SELF.fetch("http://example.com/");
  const text = await res.text();
  expect(text).toContain("Welcome to RedwoodSDK");
});

test("GET /missing returns 404", async () => {
  const res = await SELF.fetch("http://example.com/does-not-exist");
  expect(res.status).toBe(404);
});
