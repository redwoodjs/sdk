let capnwebPromise: Promise<typeof import("capnweb")> | null = null;

export function loadCapnweb(): Promise<typeof import("capnweb")> {
  if (!capnwebPromise) {
    capnwebPromise = import("capnweb")
      .catch(() => {
        throw new Error(
          'The "use-synced-state" feature requires the "capnweb" package, ' +
            "which is not installed. Install it with your package manager " +
            "(e.g. `npm install capnweb` or `pnpm add capnweb`).",
        );
      })
      .then((mod) => {
        if (
          typeof (mod as Record<string, unknown>).newWebSocketRpcSession !==
          "function"
        ) {
          throw new Error(
            'The installed "capnweb" version is incompatible with rwsdk ' +
              'use-synced-state: it does not export "newWebSocketRpcSession". ' +
              'Ensure "capnweb" matches rwsdk\'s peer-dependency range ' +
              "(see rwsdk's package.json > peerDependencies.capnweb).",
          );
        }
        return mod;
      });
  }
  return capnwebPromise;
}
