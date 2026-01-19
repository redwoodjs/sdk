import { expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import { msw } from "../../test/msw";

test("MSW intercepts fetch to /api/hello", async () => {
  msw.use(
    http.get("/api/hello", () => {
      return HttpResponse.json({ msg: "hello from msw" });
    })
  );

  const res = await fetch("/api/hello");
  expect(res.ok).toBe(true);
  const data = (await res.json()) as { msg: string };
  expect(data.msg).toBe("hello from msw");
});

test("MSW echoes POST JSON body", async () => {
  msw.use(
    http.post("/api/echo", async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({ ok: true, body });
    })
  );

  const res = await fetch("/api/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ a: 1 }),
  });
  expect(res.ok).toBe(true);
  const json = (await res.json()) as { ok: boolean; body: unknown };
  expect(json).toEqual({ ok: true, body: { a: 1 } });
});

test("MSW header-gated endpoint returns 401 without token", async () => {
  msw.use(
    http.get("/api/secure", ({ request }) => {
      return request.headers.get("x-token") === "t"
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ ok: false }, { status: 401 });
    })
  );

  const unauthorized = await fetch("/api/secure");
  expect(unauthorized.status).toBe(401);

  const authorized = await fetch("/api/secure", {
    headers: { "x-token": "t" },
  });
  expect((await authorized.json()) as { ok: boolean }).toEqual({ ok: true });
});
