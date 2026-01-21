import { describe, it, expect } from "vitest";

import { SELF } from "cloudflare:test";

describe("Worker", () => {
  it("should be able to import defineApp", async () => {
    const response = await SELF.fetch("http://localhost/_test");
    console.log(response)
  });
});
