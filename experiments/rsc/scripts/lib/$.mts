import { $ as base } from "execa";

export const $ = base({
  stdio: process.env.VERBOSE || process.env.CI ? "inherit" : "pipe",
});
