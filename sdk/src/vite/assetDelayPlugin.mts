import { Plugin, ViteDevServer } from "vite";

interface AssetDelayPluginOptions {
  delay: number; // Delay in milliseconds
}

export const assetDelayPlugin = (options: AssetDelayPluginOptions): Plugin => {
  return {
    name: "redwood-asset-delay-plugin",
    enforce: "pre",
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        console.log(
          "################################3 assets request",
          req.url,
        );
        if (req.url && req.url.startsWith("/assets/")) {
          console.log(
            `Delaying asset request for ${req.url} by ${options.delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, options.delay));
          console.log(
            `End of asset request delay for ${req.url} by ${options.delay}ms`,
          );
          next();
          return;
        }
        next();
      });
    },
  };
};
