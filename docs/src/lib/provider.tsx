"use client";

import type { ReactNode } from "react";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { RootProvider } from "fumadocs-ui/provider/base";
import { SearchProvider } from "@/app/components/SearchDialog";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RedwoodProvider>
      <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
        <SearchProvider>{children}</SearchProvider>
      </RootProvider>
    </RedwoodProvider>
  );
}
