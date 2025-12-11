import { initClient } from "rwsdk/client";

initClient({
    handleResponse: (response) => {
      // Server encodes redirects as 204 + x-rwsdk-redirect-location when using redirect: \"manual\"
      const hinted =
        response.headers.get("x-rwsdk-redirect-location") ?? undefined;
      if (hinted) {
        window.location.href = hinted;
        return false;
      }
      if (!response.ok) {
        // Surface errors by reloading current page
        window.location.href = window.location.href;
        return false;
      }
      return true;
    },
  });
