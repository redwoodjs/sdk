import { setTimeout } from "node:timers/promises";

export async function poll(
  fn: () => Promise<boolean>,
  timeout: number,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      if (await fn()) {
        return;
      }
    } catch (error) {
      // Continue polling on errors
    }

    await setTimeout(interval);
  }

  throw new Error(`Polling timed out after ${timeout}ms`);
}
