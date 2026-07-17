"use client";

import React from "react";
import { DepB } from "dep-b";

export const DepC = () =>
  React.createElement(
    "div",
    null,
    React.createElement("p", null, "Rendered by dep-c"),
    React.createElement(DepB),
  );
