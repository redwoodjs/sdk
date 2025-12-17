import { initClient, initClientNavigation } from "rwsdk/client";

const { handleResponse, onHydrationUpdate } = initClientNavigation();
initClient({ handleResponse, onHydrationUpdate });
