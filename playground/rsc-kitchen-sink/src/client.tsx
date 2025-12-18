import { initClient } from "rwsdk/client";

initClient({
  onActionResponse: (actionResponse) => {
    console.log(
      "[rsc-kitchen-sink] Intercepted action response:",
      actionResponse,
    );
    return false;
  },
});
