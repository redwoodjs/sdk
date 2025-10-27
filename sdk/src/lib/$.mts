import { execa, type Options, type ResultPromise } from "execa";

// A simplified, type-safe wrapper for execa that only exposes the
// function-call syntax, not the tagged-template literal. This prevents
// cross-platform shell parsing issues.
const $ = (
  file: string,
  args?: readonly string[],
  options?: Options,
): ResultPromise => {
  const defaultOptions: Options = {
    stdio: process.env.VERBOSE || process.env.CI ? "inherit" : "pipe",
  };

  // Combine default options with user-provided options.
  // User-provided options take precedence.
  const mergedOptions: Options = { ...defaultOptions, ...options };

  return execa(file, args, mergedOptions);
};

export { $ };

// A shell-enabled version of the safe wrapper.
export const $sh = (
  file: string,
  args?: readonly string[],
  options?: Options,
): ResultPromise => {
  const shellOptions: Options = { ...options, shell: true };
  return $(file, args, shellOptions);
};
