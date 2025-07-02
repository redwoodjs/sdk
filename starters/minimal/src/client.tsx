import { initRealtimeClient } from "rwsdk/realtime/client";

//import { initClient, initClientNavigation } from "rwsdk/client";

// initClient();

initRealtimeClient({
  key: window.location.pathname,
});

// initClientNavigation();
