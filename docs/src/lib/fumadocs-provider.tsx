"use client";

import { useSyncExternalStore, useCallback, type ReactNode } from "react";
import { FrameworkProvider } from "fumadocs-core/framework";

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getSnapshot(): string {
  return window.location.pathname;
}

function getServerSnapshot(): string {
  return "/";
}

function usePathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function useParams(): { slugs?: string[] } {
  const pathname = usePathname();
  const slugs = pathname.split("/").filter(Boolean);
  return { slugs: slugs.length > 0 ? slugs : undefined };
}

function Link({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  const { prefetch: _, ...rest } = { prefetch: undefined, ...props };
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function useRouter() {
  const push = useCallback((url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.click();
  }, []);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return { push, refresh };
}

export function RedwoodProvider({ children }: { children: ReactNode }) {
  return (
    <FrameworkProvider
      usePathname={usePathname}
      useParams={useParams}
      useRouter={useRouter}
      Link={Link}
    >
      {children}
    </FrameworkProvider>
  );
}
