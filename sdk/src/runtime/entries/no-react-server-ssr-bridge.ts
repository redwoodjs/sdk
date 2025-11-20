throw new Error(
  "rwsdk: SSR bridge was resolved with 'react-server' condition. This is a bug - the SSR bridge should be intercepted by the esbuild plugin before reaching package.json exports. Please report this issue.",
);

