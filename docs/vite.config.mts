import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";
import { redwood } from "rwsdk/vite";
import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";

// The docs app SSR-renders client components that import rwsdk/client for
// browser navigation. Keep those non-browser imports docs-local instead of
// requiring the SDK workerd client entry to expose browser navigation APIs.
function docsSsrRwsdkClientStub(): Plugin {
  const virtualModuleId = "virtual:docs-rwsdk-client-ssr-stub";
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  return {
    name: "docs:rwsdk-client-ssr-stub",
    enforce: "pre",
    resolveId(source) {
      if (source === "rwsdk/client" && this.environment.name !== "client") {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return;
      }

      return `
        export { default as React } from "react";
        export const ClientOnly = ({ children }) => children ?? null;
        export const initClient = () => {};
        export const initClientNavigation = () => ({
          handleResponse: () => {},
          onHydrated: () => {},
        });
        export const navigate = () => {};
        export const useNavigationPending = () => ({
          currentUrl: new URL("http://localhost/"),
          pending: null,
        });
        export function NavigationPending({ children }) {
          return children ?? null;
        }
      `;
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      // rwsdk doesn't use vite-tsconfig-paths, so mirror tsconfig paths here
      "@/": path.resolve("src") + "/",
      "@source": path.resolve(".source"),
      // Stub unused optional peer deps of fumadocs so rwsdk's client barrel
      // doesn't crash when it encounters them at runtime.
      flexsearch: path.resolve("src/lib/module-stub.ts"),
      "@takumi-rs/image-response": path.resolve("src/lib/module-stub.ts"),
    },
  },
  plugins: [
    docsSsrRwsdkClientStub(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood({
      // fumadocs-mdx generates component imports at build time, after rwsdk's
      // directive scan has run. forceClientPaths pre-registers these modules in
      // the vendor barrel so they're available when discovered during reloads.
      forceClientPaths: [
        "node_modules/fumadocs-ui/dist/**/!(og|next|waku|react-router|tanstack|mdx|*.server).js",
        "node_modules/fumadocs-core/dist/**/!(next|waku|react-router|tanstack|middleware).js",
      ],
      directiveScanBlocklist: ["fumadocs-core/dist/framework", "fumadocs-ui/dist/provider"],
    }),
    tailwindcss(),
    mdx(MdxConfig),
  ],
});
