import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { appendDiagnosticFile, recordDiagnostic } from "./diagnostics.mjs";
import { runTestWithRetries } from "./testHarness.mjs";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("retains preview output and lifecycle events outside fixture cleanup", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rwsdk-diagnostics-"));
  try {
    vi.stubEnv("RWSDK_E2E_ARTIFACT_DIR", path.join(directory, "artifacts"));
    recordDiagnostic("page.close.start", { name: "rendering" });
    appendDiagnosticFile("preview-4173.log", "original preview error\n");
    const event = JSON.parse(
      await readFile(
        path.join(directory, "artifacts", `events-${process.pid}.jsonl`),
        "utf8",
      ),
    );
    expect(event).toMatchObject({
      event: "page.close.start",
      name: "rendering",
    });
    expect(Number.isNaN(Date.parse(event.time))).toBe(false);
    expect(
      await readFile(
        path.join(directory, "artifacts", "preview-4173.log"),
        "utf8",
      ),
    ).toBe("original preview error\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports the original retry exception and rethrows it", async () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => {});
  const failure = new Error("original browser failure");
  vi.useFakeTimers();
  const assertion = expect(
    runTestWithRetries("rendering", async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  await vi.runAllTimersAsync();
  await assertion;
  expect(output).toHaveBeenCalledWith(
    expect.stringContaining("rendering, attempt 1"),
    failure.stack,
  );
});
