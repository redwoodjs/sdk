import { setTimeout } from "node:timers/promises";

const log = console.log;

export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number },
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      log(`Attempt ${i + 1} failed. Retrying in ${options.delay}ms...`);
      await setTimeout(options.delay);
    }
  }
  throw lastError;
}
