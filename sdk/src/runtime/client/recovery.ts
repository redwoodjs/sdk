export type RecoveryState = "idle" | "waiting" | "checking" | "reload";

export type RecoveryController = {
  readonly state: RecoveryState;
  readonly attempts: number;
  readonly elapsedMs: number;
  retry(): void;
  reload(): void;
};

export type RecoveryCallback = (
  controller: RecoveryController,
) => void | Promise<void>;

export type RecoveryHandler = "reloadWhenReady" | RecoveryCallback;

export type RecoveryOptions = {
  onDisconnected?: RecoveryHandler;
  onModuleNotFound?: RecoveryHandler;
};

const DEFAULT_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10000;
const FALLBACK_TIMEOUT_MS = 30000;

let configuredOptions: RecoveryOptions = {};
let activeController: RecoveryController | null = null;

function getBackoffMs(attempt: number): number {
  const base = Math.min(DEFAULT_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}

async function checkUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

function createController(): RecoveryController & {
  _setState(state: RecoveryState): void;
  _incAttempts(): void;
  _wait(ms: number): Promise<void>;
} {
  let state: RecoveryState = "idle";
  let attempts = 0;
  const startedAt = Date.now();
  let wakeResolver: (() => void) | null = null;
  let abortController = new AbortController();

  const controller = {
    get state() {
      return state;
    },
    get attempts() {
      return attempts;
    },
    get elapsedMs() {
      return Date.now() - startedAt;
    },
    _setState(next: RecoveryState) {
      state = next;
    },
    _incAttempts() {
      attempts++;
    },
    retry() {
      wakeResolver?.();
    },
    reload() {
      abortController.abort();
      state = "reload";
      wakeResolver?.();
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    _wait(ms: number) {
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, ms);
        wakeResolver = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    },
  };

  return controller;
}

export function configureRecovery(options: RecoveryOptions): void {
  configuredOptions = options;
}

export function startRecovery(
  reason: "disconnected" | "module-not-found",
): void {
  if (typeof window === "undefined") {
    return;
  }

  if (activeController) {
    activeController.reload();
    return;
  }

  const handler =
    reason === "disconnected"
      ? configuredOptions.onDisconnected
      : configuredOptions.onModuleNotFound;

  const controller = createController();
  activeController = controller;

  const run = async () => {
    controller._setState("waiting");

    if (typeof handler === "function") {
      try {
        await handler(controller);
      } catch (error) {
        console.error("[rwsdk] recovery callback threw", error);
      }
    }

    const currentUrl = window.location.href;

    while (activeController === controller) {
      controller._setState("checking");
      controller._incAttempts();

      const ok = await checkUrl(currentUrl, new AbortController().signal);
      if (ok) {
        controller.reload();
        return;
      }

      if (controller.elapsedMs >= FALLBACK_TIMEOUT_MS) {
        const indexUrl = `${window.location.origin}/`;
        const indexOk = await checkUrl(indexUrl, new AbortController().signal);
        if (indexOk) {
          window.location.href = "/";
          return;
        }
      }

      controller._setState("waiting");
      await controller._wait(getBackoffMs(controller.attempts));
    }
  };

  void run();
}

export function isDynamicImportFailure(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    typeof (error as Error).message === "string" &&
    (error as Error).message.includes("dynamically imported module")
  );
}
