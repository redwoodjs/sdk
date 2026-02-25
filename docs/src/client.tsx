import { initClient, initClientNavigation } from "rwsdk/client";

const { handleResponse, onHydrated } = initClientNavigation();
initClient({
  handleResponse,
  onHydrated,
  hydrateRootOptions: {
    onUncaughtError: (error, errorInfo) => {
      console.error("Uncaught error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    },
    onCaughtError: (error, errorInfo) => {
      console.error("Caught error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    },
  },
});
