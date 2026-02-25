import type { LayoutProps } from "rwsdk/router";
import { RedwoodProvider } from "@/lib/fumadocs-provider";
import { RootProvider } from "fumadocs-ui/provider/base";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Sidebar, MobileNav } from "@/app/components/Sidebar";
import { pageTree } from "@/app/sidebar";

export function DocsLayoutWrapper({ children, requestInfo }: LayoutProps) {
  const pathname = requestInfo
    ? new URL(requestInfo.request.url).pathname
    : "/";
  return (
    <RedwoodProvider pathname={pathname}>
      <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
        <MobileNav pathname={pathname} />
        <DocsLayout
          tree={pageTree}
          nav={{ enabled: false }}
          sidebar={{ component: <Sidebar pathname={pathname} /> }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </RedwoodProvider>
  );
}
