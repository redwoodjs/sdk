import React from "react";
import { packageClientUtil } from "./client.mjs";

export function PackageServerComponent() {
  const message = packageClientUtil.format("Package Server Component");

  return React.createElement(
    "div",
    null,
    React.createElement("p", null, "A server component from ui-lib."),
    React.createElement(
      "p",
      null,
      "It used a client util to generate this message:",
    ),
    React.createElement(
      "p",
      { id: "message-from-package-server-component" },
      message,
    ),
  );
}
