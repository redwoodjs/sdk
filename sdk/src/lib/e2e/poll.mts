import { setTimeout } from "node:timers/promises";

const POLL_TIMEOUT = process.env.RWSDK_POLL_TIMEOUT
  ? parseInt(process.env.RWSDK_POLL_TIMEOUT, 10)
  : 2 * 60 * 1000;

export async function poll(
  fn: () => Promise<boolean>,
  timeout: number = POLL_TIMEOUT,
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
