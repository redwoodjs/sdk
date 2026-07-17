"use client";

import React from "react";
import { DepB } from "dep-b";

export const DepA = () =>
  React.createElement(
    "div",
    null,
    React.createElement("p", null, "Rendered by dep-a"),
    React.createElement(DepB),
  );
