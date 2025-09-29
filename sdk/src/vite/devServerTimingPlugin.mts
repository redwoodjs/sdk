import debug from "debug";
import { Plugin } from "vite";

const log = debug("rwsdk:vite:dev-server-timing-plugin");

export const devServerTimingPlugin = (): Plugin => {
  const startTime = Date.now();
  let hasLoggedFirstResponse = false;

  return {
    name: "rwsdk:dev-server-timing",
    configureServer(server) {
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
