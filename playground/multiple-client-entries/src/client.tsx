import { initClient } from "rwsdk/client";

initClient({
  onRender: () => {
    console.log("main client rendered");
  },
});
