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

