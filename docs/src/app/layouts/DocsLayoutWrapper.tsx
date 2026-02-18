import type { LayoutProps } from "rwsdk/router";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { memo } from "react";
import { Sidebar } from "@/app/components/Sidebar";

export const DocsLayoutWrapper = memo(({ children, requestInfo }: LayoutProps) => {
  const pathname = new URL(requestInfo!.request.url).pathname;
  const theme = requestInfo!.ctx?.theme as "dark" | "light" | "system" | undefined;
  return (
    <RedwoodProvider>
      <div
        id="nd-docs-layout"
        className="grid min-h-(--fd-docs-height) overflow-x-clip [--fd-docs-height:100dvh] [--fd-header-height:0px] [--fd-toc-popover-height:0px] [--fd-sidebar-width:0px] [--fd-toc-width:0px]"
        style={{
          gridTemplate: `"sidebar sidebar main toc toc" 1fr / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, calc(var(--fd-layout-width, 97rem) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(min-content, 1fr)`,
          "--fd-docs-row-1": "var(--fd-banner-height, 0px)",
          "--fd-docs-row-2": "calc(var(--fd-docs-row-1) + var(--fd-header-height))",
          "--fd-docs-row-3": "calc(var(--fd-docs-row-2) + var(--fd-toc-popover-height))",
          "--fd-sidebar-col": "var(--fd-sidebar-width)",
        } as React.CSSProperties}
      >
        <Sidebar pathname={pathname} initialTheme={theme} />
        {children}
      </div>
    </RedwoodProvider>
  );
})
