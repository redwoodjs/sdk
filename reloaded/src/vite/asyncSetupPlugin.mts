import { Plugin } from "vite";

export const asyncSetupPlugin = ({
  setup,
}: {
  setup: ({ command }: { command: 'serve' | 'build' }) => Promise<unknown>;
}): Plugin[] => {
  let taskPromise = Promise.resolve(null as unknown);

  return [{
    name: "rw-reloaded-async-setup:serve",
    apply: 'serve',
    configureServer(server) {
      taskPromise = setup({ command: 'serve' as const });

      server.middlewares.use(async (_req, _res, next) => {
        await taskPromise;
        next();
      });
    },
  }, {
    name: "rw-reloaded-async-setup:build",
    apply: 'build',
    async buildStart() {
      await setup({ command: 'build' as const });
    },
  }];
};
