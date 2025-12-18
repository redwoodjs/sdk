import { initClient } from "rwsdk/client";

initClient({
  onActionResponse: (ctx) => {
    console.log("[rsc-kitchen-sink] Intercepted action response:", ctx);

    if (ctx.redirect.kind === "redirect") {
      console.log(
        `[rsc-kitchen-sink] Action requested a redirect to: ${ctx.redirect.url}`,
      );
    }
  },
});
