import { defineConfig } from "vite";
import { redwood } from "redwoodsdk/vite";

export default defineConfig({
  plugins: [
    redwood(),
  ],
});