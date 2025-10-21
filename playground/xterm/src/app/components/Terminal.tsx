"use client";

import type { JSX } from "react";

import { lazy, useEffect, useState } from "react";

const ClientTerminal = lazy(async () => {
  if (import.meta.env.SSR) {
    return { default: () => null as unknown as JSX.Element };
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await import("./ClientTerminal").then((mod) => ({
    default: mod.Terminal,
  }));
});

export function Terminal() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  return isReady ? <ClientTerminal /> : null;
}
