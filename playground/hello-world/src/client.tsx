import { initClient } from "rwsdk/client";

const redirectToError = () => {
  window.location.href = "/error";
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
