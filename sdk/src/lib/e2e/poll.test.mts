import { expect, test } from "vitest";
import { poll } from "./poll.mjs";

test("reports the last error when polling times out", async () => {
  const lastError = new Error("the client component did not render");

  await expect(
    poll(
      async () => {
        throw lastError;
      },
      { timeout: 0, interval: 0, minTries: 1 },
    ),
  ).rejects.toMatchObject({
    message: expect.stringContaining(
      "Last error: the client component did not render",
    ),
    cause: lastError,
  });
});

test("reports a timeout when polling returns false without an error", async () => {
  await expect(
    poll(async () => false, { timeout: 0, interval: 0, minTries: 1 }),
  ).rejects.toThrow("Polling timed out");
});
