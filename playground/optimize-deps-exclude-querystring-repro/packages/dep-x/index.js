import React from "react";
import { DepA } from "dep-a";

export const DepX = () => {
  return React.createElement(DepA, null, "Rendered by dep-x");
};
