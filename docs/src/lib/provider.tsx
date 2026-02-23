"use client";

import type { ReactNode } from "react";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { RootProvider } from "fumadocs-ui/provider/base";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RedwoodProvider>
      <RootProvider
        theme={{ enabled: false }}
        search={{
          SearchDialog: DefaultSearchDialog,
        }}
      >
        {children}
      </RootProvider>
    </RedwoodProvider>
  );
}
