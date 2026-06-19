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
  onModuleNotFound?: RecoveryHandler;
};

const DEFAULT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const FALLBACK_TIMEOUT_MS = 30000;
const FALLBACK_TIMEOUT_JITTER_MS = 10000;
const STARTUP_JITTER_MS = 1000;

let configuredOptions: RecoveryOptions = {};
let activeController: RecoveryController | null = null;

function debugLog(...args: unknown[]): void {
  if (
    typeof window !== "undefined" &&
    ((window as any).__RWSDK_DEBUG__ ||
      (window as any).__RWSDK_DEBUG_RECOVERY__)
  ) {
    console.log("[rwsdk:recovery]", ...args);
  }
}

function getBackoffMs(attempt: number): number {
  const base = Math.min(DEFAULT_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}

function getJitteredFallbackTimeoutMs(): number {
  return (
    FALLBACK_TIMEOUT_MS + Math.round(Math.random() * FALLBACK_TIMEOUT_JITTER_MS)
  );
}

function normalizeRecoveryUrl(url: string): string {
  const parsed = new URL(url);
  // A trailing dot on the hostname (e.g. example.com.) is a DNS root
  // indicator that some Cloudflare Workers routes treat differently. Strip
  // it so the health check hits the same origin the app uses normally.
  parsed.hostname = parsed.hostname.replace(/\.$/, "");
  // Drop query string and hash: we only care whether the document route
  // itself is ready.
  return `${parsed.origin}${parsed.pathname}`;
}

function getCurrentHydrateRootId(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const root = document.getElementById("hydrate-root");
  return root?.tagName.toLowerCase() ?? null;
}

async function checkUrl(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal,
    });

    if (response.status !== 200) {
      debugLog("checked", url, "status", response.status, "ok", false);
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      debugLog("checked", url, "content-type", contentType, "ok", false);
      return false;
    }

    const text = await response.text();
    const isHtml = /<!doctype html|<html/i.test(text);
    if (!isHtml) {
      debugLog("checked", url, "not html", "ok", false);
      return false;
    }

    const currentRootId = getCurrentHydrateRootId();
    if (currentRootId) {
      // Match the current hydrate root element. We look for id="hydrate-root"
      // or id='hydrate-root' followed by the same tag name.
      const rootPattern = new RegExp(
        `id=["']hydrate-root["'][^>]*>\\s*<${currentRootId}\\b`,
        "i",
      );
      const rootMatches = rootPattern.test(text);
      debugLog(
        "checked",
        url,
        "status",
        200,
        "rootId",
        currentRootId,
        "rootMatches",
        rootMatches,
        "ok",
        rootMatches,
      );
      return rootMatches;
    }

    debugLog("checked", url, "status", 200, "html", true, "ok", true);
    return true;
  } catch (error) {
    debugLog("check failed", url, error);
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

export function isRecoveryConfigured(): boolean {
  return configuredOptions.onModuleNotFound != null;
}

export function startRecovery(reason: "module-not-found"): void {
  if (typeof window === "undefined") {
    return;
  }

  debugLog("start", reason);

  if (activeController) {
    debugLog("already recovering, ignoring duplicate");
    return;
  }

  const handler = configuredOptions.onModuleNotFound;

  const controller = createController();
  activeController = controller;

  const run = async () => {
    controller._setState("waiting");
    debugLog(
      "waiting, handler",
      typeof handler === "function" ? "custom" : handler,
    );

    if (typeof handler === "function") {
      try {
        await handler(controller);
      } catch (error) {
        console.error("[rwsdk] recovery callback threw", error);
      }
    }

    const currentUrl = normalizeRecoveryUrl(window.location.href);
    const fallbackTimeoutMs = getJitteredFallbackTimeoutMs();

    const startupJitter = Math.round(Math.random() * STARTUP_JITTER_MS);
    debugLog("startup jitter", startupJitter, "ms");
    await controller._wait(startupJitter);

    while (activeController === controller) {
      controller._setState("checking");
      controller._incAttempts();
      debugLog(
        "checking",
        currentUrl,
        "attempt",
        controller.attempts,
        "elapsed",
        controller.elapsedMs,
      );

      const ok = await checkUrl(currentUrl, new AbortController().signal);
      if (ok) {
        debugLog("current route ready, reloading");
        controller.reload();
        return;
      }

      if (controller.elapsedMs >= fallbackTimeoutMs) {
        debugLog("fallback timeout reached, checking /");
        const indexUrl = `${new URL(window.location.href).origin}/`;
        const indexOk = await checkUrl(indexUrl, new AbortController().signal);
        if (indexOk) {
          debugLog("/ ready, navigating to /");
          window.location.href = "/";
          return;
        }
      }

      const backoff = getBackoffMs(controller.attempts);
      debugLog("not ready, backing off", backoff, "ms");
      controller._setState("waiting");
      await controller._wait(backoff);
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
