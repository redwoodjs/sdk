import { HotUpdateOptions, Plugin } from "vite";
import colors from "picocolors";
import { getShortName } from "../getShortName.mjs";

export const restartPlugin = ({
  filter,
}: {
  filter: (filepath: string) => boolean;
}): Plugin => {
  let restarting = false;
  let ready = false;

  return {
    name: "rw-sdk-restart-dev-server",

    async hotUpdate(ctx) {
      // context(justinvdm, 12 Dec 2024): We're already restarting, so stop all hmr
      if (restarting) {
        return [];
      }

      // context(justinvdm, 12 Dec 2024): Server isn't ready yet, so pass on to next plugin
      if (!ready) {
        return;
      }

      if (filter(ctx.file)) {
        restarting = true;
        const shortName = getShortName(ctx.file, ctx.server.config.root);

        this.environment.logger.info(
          `${colors.green("restarting dev server")} ${colors.dim(shortName)}`,
          {
            clear: true,
            timestamp: true,
          },
        );

        // context(justinvdm, 2024-12-13):
        // * This plugin assumes the dev server script will rerun if closed with a zero exit code
        // (e.g. `while true; do NODE_ENV=development npx tsx dev.mts; [ $? -eq 0 ] || break; done`)
        // * In the browser, the vite's HMR client will keeping retry reconnecting to the dev server
        await ctx.server.close();

        return [];
      }
    },
    configureServer(server) {
      // context(justinvdm, 12 Dec 2024): Wait until the server has responded to a test request
      // before allowing the server to be restarted. Otherwise vite's HMR client retry mechanism
      // won't yet be ready. Otherwise, if we restarted while the client was busy with a (so far successful)
      // retry, a restart would cause the browser to show an builtin error page instead of continuing to retry
      server.httpServer?.on("listening", async () => {
        const address = server.httpServer?.address();
        const port = typeof address === "string" ? address : address?.port;
        await fetch(`http://localhost:${port}/__vite_ping`);
        ready = true;
      });
    },
  };
};
