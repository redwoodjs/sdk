import { initClient, initClientNavigation } from "rwsdk/client";

const { handleResponse } = initClientNavigation();
initClient({ handleResponse });
