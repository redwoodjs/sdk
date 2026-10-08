import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function appendDiagnosticFile(name: string, content: string): void {
  const directory = process.env.RWSDK_E2E_ARTIFACT_DIR;
  if (!directory) {
    return;
  }
  try {
    mkdirSync(directory, { recursive: true });
    appendFileSync(path.join(directory, name), content);
  } catch (error) {
    console.warn(
      "Unable to save E2E diagnostics:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function recordDiagnostic(
  event: string,
  details: Record<string, unknown> = {},
): void {
  appendDiagnosticFile(
    `events-${process.pid}.jsonl`,
    JSON.stringify({ time: new Date().toISOString(), event, ...details }) +
      "\n",
  );
}
