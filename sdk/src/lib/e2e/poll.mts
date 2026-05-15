import { setTimeout } from "node:timers/promises";

const POLL_TIMEOUT = process.env.RWSDK_POLL_TIMEOUT
  ? parseInt(process.env.RWSDK_POLL_TIMEOUT, 10)
  : 2 * 60 * 1000;

export interface PollOptions {
  timeout: number;
  interval: number;
  minTries: number;
  onRetry?: (error: unknown, tries: number) => void;
}

export async function poll(
  fn: () => boolean | Promise<boolean>,
  options: Partial<PollOptions> = {},
): Promise<void> {
  const {
    timeout = POLL_TIMEOUT,
    interval = 100,
    minTries = 3,
    onRetry,
  } = options;

  const startTime = Date.now();
  let tries = 0;

  while (Date.now() - startTime < timeout || tries < minTries) {
    tries++;
    try {
      if (await fn()) {
        return;
      }
    } catch (error) {
      onRetry?.(error, tries);
      // Continue polling on errors
    }

    await setTimeout(interval);
  }

  throw new Error(
    `Polling timed out after ${Date.now() - startTime}ms and ${tries} attempts`,
  );
}

export async function pollValue<T>(
  fn: () => Promise<T>,
  options: Partial<PollOptions> = {},
): Promise<T> {
  let value: T | undefined;

  await poll(async () => {
    value = await fn();
    return true;
  }, options);

  return value as unknown as T;
}
