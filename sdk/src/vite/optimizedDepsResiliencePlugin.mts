import debug from "debug";
import { type Plugin, type ViteDevServer } from "vite";

const log = debug("rws-vite-plugin:middleware");

// State for handling retries with backoff
let lastErrorTimestamp = 0;
let retryCount = 0;
const INITIAL_DELAY_MS = 100;
const MAX_RETRIES = 5;
// If we don't see a stale error for 5s, reset the counter.
const RESET_INTERVAL_MS = 5000;

export function optimizedDepsResiliencePlugin(): Plugin {
  return {
    name: "rws-vite-plugin:optimized-deps-resilience",
    configureServer(server: ViteDevServer) {
      // Return a function to ensure our middleware is placed after internal middlewares
      return () => {
        server.middlewares.use(async function rwsdkStaleBundleErrorHandler(
          err: any,
          req: any,
          res: any,
          next: any,
        ) {
          if (
            err &&
            typeof err.message === "string" &&
            err.message.includes("new version of the pre-bundle")
          ) {
            const now = Date.now();

            // If the last error was a while ago, treat this as a new event.
            if (now - lastErrorTimestamp > RESET_INTERVAL_MS) {
              retryCount = 0;
            }

            lastErrorTimestamp = now;

            if (retryCount < MAX_RETRIES) {
              const delay = INITIAL_DELAY_MS * 2 ** retryCount;
              retryCount++;

              log(
                `Caught stale pre-bundle error (attempt #${retryCount}). Waiting ${delay}ms before redirecting.`,
              );

              await new Promise((r) => setTimeout(r, delay));

              res.writeHead(307, { Location: req.url });
              res.end();
              return;
            } else {
              log(
                `Max retries (${MAX_RETRIES}) reached for stale bundle error. Forwarding error.`,
              );
              // Reset for the next event and pass the error along.
              retryCount = 0;
            }
          }
          next(err);
        });
      };
    },
  };
}
