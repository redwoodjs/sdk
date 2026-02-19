"use client";

import { useSyncExternalStore, useCallback, type ReactNode } from "react";
import { FrameworkProvider } from "fumadocs-core/framework";
import { navigate } from "rwsdk/client";

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

function getServerSnapshot(): string {
  return "/";
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function useParams(): { slugs?: string[] } {
  const pathname = usePathname();
  const slugs = pathname.split("/").filter(Boolean);
  return { slugs: slugs.length > 0 ? slugs : undefined };
}

function Link({
  href,
  prefetch,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) {
  return (
    <>
      {prefetch && href && <link rel="x-prefetch" href={href} />}
      <a href={href} {...props}>
        {children}
      </a>
    </>
  );
}

function useRouter() {
  const push = useCallback((url: string) => {
    navigate(url);
  }, []);

  const refresh = useCallback(() => {
    navigate(window.location.href, { history: "replace" });
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
