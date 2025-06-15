import { Plugin } from "vite";
import debug from "debug";

const log = debug("rwsdk:vite:dev-server-timing-plugin");

export const devServerTimingPlugin = (): Plugin => {
  const startTime = Date.now();
  let hasLoggedFirstResponse = false;

  return {
    name: "rwsdk:dev-server-timing",
    configureServer(server) {
      // Hook into the middleware to catch the first successful response
      server.middlewares.use((req, res, next) => {
        if (!hasLoggedFirstResponse) {
          // Listen for when the response is finished
          const originalEnd = res.end.bind(res);
          res.end = ((...args: any[]) => {
            if (!hasLoggedFirstResponse) {
              hasLoggedFirstResponse = true;
              const endTime = Date.now();
              const duration = endTime - startTime;
              log(`🚀 Dev server first response completed in ${duration}ms`);
            }
            // Call the original end method
            return (originalEnd as any)(...args);
          }) as typeof res.end;
        }
        next();
      });
    },
  };
};
