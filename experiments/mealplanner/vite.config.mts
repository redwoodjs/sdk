import { defineConfig } from "vite";
import { redwood } from "@redwoodjs/sdk/vite";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    redwood(),
  ],
});