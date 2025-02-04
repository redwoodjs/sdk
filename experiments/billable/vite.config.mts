import { defineConfig } from "vite";
import { redwoodPlugin } from "@redwoodjs/reloaded/vite";

export default defineConfig({
  plugins: [
    redwoodPlugin(),
  ],
});