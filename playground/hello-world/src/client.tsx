import { initClient } from "rwsdk/client";

// Example: Error handling with React 19 APIs
initClient({
  hydrateRootOptions: {
    onUncaughtError: (error, errorInfo) => {
      console.error("Uncaught error:", error);
      console.error("Component stack:", errorInfo.componentStack);
      // In a real app, you would send this to a monitoring service
      // e.g., Sentry.captureException(error, { contexts: { react: errorInfo } });
    },
    onCaughtError: (error, errorInfo) => {
      console.error("Caught error:", error);
      console.error("Component stack:", errorInfo.componentStack);
      // In a real app, you would send this to a monitoring service
    },
  },
});
