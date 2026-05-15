let capnwebPromise: Promise<typeof import("capnweb")> | null = null;

export function loadCapnweb(): Promise<typeof import("capnweb")> {
  if (!capnwebPromise) {
    capnwebPromise = import("capnweb").catch(() => {
      throw new Error(
        'The "use-synced-state" feature requires the "capnweb" package, ' +
          'which is not installed. Install it with your package manager ' +
          '(e.g. `npm install capnweb` or `pnpm add capnweb`).',
      );
    });
  }
  return capnwebPromise;
}
