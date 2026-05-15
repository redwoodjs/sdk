throw new Error(
  "RedwoodSDK: A client-only module was incorrectly resolved with the 'react-server' condition.\n\n" +
    "This error occurs when modules like 'rwsdk/client', 'rwsdk/__ssr', or 'rwsdk/__ssr_bridge' are being imported in a React Server Components context.\n\n" +
    "For detailed troubleshooting steps, see: https://docs.rwsdk.com/guides/troubleshooting#react-server-components-configuration-errors",
);
