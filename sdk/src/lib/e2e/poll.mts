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
  let lastError: unknown;

  while (Date.now() - startTime < timeout || tries < minTries) {
    tries++;
    try {
      if (await fn()) {
        return;
      }
    } catch (error) {
      lastError = error;
      onRetry?.(error, tries);
      // Continue polling on errors
    }

    await setTimeout(interval);
  }

  const timeoutMessage = `Polling timed out after ${Date.now() - startTime}ms and ${tries} attempts`;

  // context(chrsnymn, 05 Nov 2026): The assertion explains which value never
  // appeared. Preserve it so a timeout does not replace the useful failure
  // with only an elapsed time and attempt count.
  if (lastError instanceof Error) {
    throw new Error(`${timeoutMessage}. Last error: ${lastError.message}`, {
      cause: lastError,
    });
  }

  throw new Error(timeoutMessage);
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
