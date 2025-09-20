import { defineConfig } from "vite";
import { rwsdk } from "@redwoodjs/sdk/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [rwsdk(), tsconfigPaths()],
});
