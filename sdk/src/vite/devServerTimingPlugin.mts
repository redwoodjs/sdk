import debug from "debug";
import { Plugin } from "vite";

const log = debug("rwsdk:vite:dev-server-timing-plugin");

export const devServerTimingPlugin = (): Plugin => {
  const startTime = Date.now();
  let hasLoggedFirstResponse = false;

  return {
    name: "rwsdk:dev-server-timing",
    configureServer(server) {
      // context(justinvdm, 19 Nov 2025): This hook adds a middleware for
      // logging the time to first response. Unlike other plugins that must
      // run before the Cloudflare plugin to prevent startup deadlocks, its
      // execution order is not critical, so `enforce: 'pre'` is not needed.
      server.middlewares.use((_req, res, next) => {
        if (!hasLoggedFirstResponse) {
          res.on("finish", () => {
            if (!hasLoggedFirstResponse) {
              hasLoggedFirstResponse = true;
              const endTime = Date.now();
              const duration = endTime - startTime;
              log(`🚀 Dev server first response completed in ${duration}ms`);
            }
          });
        }
        next();
      });
    },
  };
};
