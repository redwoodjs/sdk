"use client";

import type { ReactNode } from "react";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { RootProvider } from "fumadocs-ui/provider/base";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RedwoodProvider>
      <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
    </RedwoodProvider>
  );
}
