import { initClient } from "rwsdk/client";

initClient({
  onRender: () => {
    console.log("admin client rendered");
  },
});
