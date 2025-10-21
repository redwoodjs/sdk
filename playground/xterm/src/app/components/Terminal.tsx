"use client";

import { lazy } from "react";

const ClientTerminal = lazy(async () => {
  if (import.meta.env.SSR) {
    return { default: () => null };
  }

  return await import("./ClientTerminal").then((mod) => ({
    default: mod.Terminal,
  }));
});

export function Terminal() {
  return <ClientTerminal />;
}
