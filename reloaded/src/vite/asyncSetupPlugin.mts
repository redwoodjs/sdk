import { Plugin } from "vite";

export const asyncSetupPlugin = ({
  setup,
}: {
  setup: () => Promise<unknown>;
}): Plugin => {
  let taskPromise = Promise.resolve(null as unknown);

  return {
    name: "rw-reloaded-async-setup",
    apply: 'serve',
    // Hook into the configureServer to add middleware
    configureServer(server) {
      // Start the async task when the server is configured
      taskPromise = setup();

      // Add middleware to block requests until the task is completed
      server.middlewares.use(async (_req, _res, next) => {
        await taskPromise;
        next();
      });
    },
  };
};
