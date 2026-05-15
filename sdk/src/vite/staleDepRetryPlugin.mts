import debug from "debug";
import { type Connect, type Plugin, type ViteDevServer } from "vite";

const log = debug("rwsdk:vite:stale-dep-retry-plugin");

let stabilityPromise: Promise<void> | null = null;
let stabilityResolver: (() => void) | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

const DEBOUNCE_MS = 500;

function startWaitingForStability() {
  if (!stabilityPromise) {
    log("Starting to wait for server stability...");
    stabilityPromise = new Promise((resolve) => {
      stabilityResolver = resolve;
    });
    // Start the timer. If it fires, we're stable.
    debounceTimer = setTimeout(finishWaiting, DEBOUNCE_MS);
  }
}

function activityDetected() {
  if (stabilityPromise) {
    // If we're waiting for stability, reset the timer.
    log("Activity detected, resetting stability timer.");
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(finishWaiting, DEBOUNCE_MS);
  }
}

function finishWaiting() {
  if (stabilityResolver) {
    log("Server appears stable. Resolving promise.");
    stabilityResolver();
  }
  stabilityPromise = null;
  stabilityResolver = null;
  debounceTimer = null;
}

export function staleDepRetryPlugin(): Plugin {
  return {
    name: "rws-vite-plugin:stale-dep-retry",
    apply: "serve",

    // Monitor server activity by tapping into the transform hook. This is a
    // reliable indicator that Vite is busy processing modules.
    transform() {
      activityDetected();
      return null;
    },

    configureServer(server: ViteDevServer) {
      // context(justinvdm, 19 Nov 2025): This hook adds an error handling
      // middleware for stale dependency errors. It runs in a returned function,
      // which intentionally places it late in the middleware stack. Unlike
      // other plugins that must run before the Cloudflare plugin to prevent
      // startup deadlocks, its timing is not critical, so `enforce: 'pre'`
      // is not needed.
      return () => {
        server.middlewares.use(async function rwsdkStaleBundleErrorHandler(
          err: any,
          req: Connect.IncomingMessage,
          res: any,
          next: Connect.NextFunction,
        ) {
          if (
            err &&
            typeof err.message === "string" &&
            err.message.includes("new version of the pre-bundle")
          ) {
            log(
              "Caught stale pre-bundle error. Waiting for server to stabilize...",
            );

            startWaitingForStability();
            await stabilityPromise;

            log("Server stabilized. Sending full-reload and redirecting.");

            // Signal the client to do a full page reload.
            server.environments.client.hot.send({
              type: "full-reload",
            });

            res.writeHead(307, { Location: req.originalUrl || req.url });
            res.end();
            return;
          }
          next(err);
        });
      };
    },
  };
}
