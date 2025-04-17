// @ts-ignore
export { __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE } from "react";

// This file is built in both development and production modes
// The customReactBuildPlugin will use the appropriate build based on the Vite mode
if (process.env.NODE_ENV === "development") {
  console.debug("[rwsdk] Using development build of React Server Internals");
}
