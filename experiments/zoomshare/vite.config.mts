import { defineConfig } from "vite";
import { redwood } from "redwood-sdk/vite";

export default defineConfig({
  plugins: [
    redwood(),
  ],
});