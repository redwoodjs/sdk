import { initClient } from "rwsdk/client";

const redirectToError = () => {
  window.location.replace("/error");
};

window.addEventListener("error", () => {
  redirectToError();
});

window.onunhandledrejection = () => {
  redirectToError();
};

initClient({
  hydrateRootOptions: {
    onUncaughtError: () => {
      redirectToError();
    },
    onCaughtError: () => {
      redirectToError();
    },
  },
});
