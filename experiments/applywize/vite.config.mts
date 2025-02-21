import svgr from 'vite-plugin-svgr'
import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite'
import { redwood } from "@redwoodjs/sdk/vite";

export default defineConfig({
  assetsInclude: ['**/*.svg'],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  plugins: [
    redwood(),
    tailwindcss(),
  ],
});
