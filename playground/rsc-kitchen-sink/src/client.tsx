import { initClient } from "rwsdk/client";

initClient({
  onActionResponse: (actionResponse) => {
    console.log(
      "[rsc-kitchen-sink] Intercepted action response:",
      actionResponse,
    );
    const location = actionResponse.headers.location;
    const isRedirect =
      actionResponse.status >= 300 && actionResponse.status < 400;
    if (location && isRedirect) {
      console.log(
        "[rsc-kitchen-sink] Action requested a redirect to:",
        location,
      );
    }
    return false;
  },
});
