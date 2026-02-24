"use client";

import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { RootProvider } from "fumadocs-ui/provider/base";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RedwoodProvider>
      <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
        {children}
      </RootProvider>
    </RedwoodProvider>
  );
}
