import type { LayoutProps } from "rwsdk/router";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Sidebar } from "@/app/components/Sidebar";
import { pageTree } from "@/app/sidebar";

export function DocsLayoutWrapper({ children, requestInfo }: LayoutProps) {
  const pathname = requestInfo
    ? new URL(requestInfo.request.url).pathname
    : "/";
  const theme = (requestInfo?.ctx?.theme ?? "system") as
    | "dark"
    | "light"
    | "system";
  return (
    <RedwoodProvider>
      <DocsLayout
        tree={pageTree}
        nav={{ enabled: false }}
        sidebar={{ component: <Sidebar pathname={pathname} initialTheme={theme} /> }}
      >
        {children}
      </DocsLayout>
    </RedwoodProvider>
  );
}
