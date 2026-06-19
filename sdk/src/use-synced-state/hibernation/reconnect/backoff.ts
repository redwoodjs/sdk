const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export function getBackoffMs(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}
