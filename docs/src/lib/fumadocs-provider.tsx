"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import { FrameworkProvider } from "fumadocs-core/framework";
import { navigate } from "rwsdk/client";

/**
 * Holds the server-rendered pathname so that `useSyncExternalStore` returns the
 * correct value during SSR instead of always falling back to "/".
 */
const PathnameContext = createContext("/");

function subscribe(callback: () => void): () => void {
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

export function usePathname(): string {
  const serverPathname = useContext(PathnameContext);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverPathname);
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

/**
 * Bridges fumadocs' framework-agnostic APIs (usePathname, useRouter, Link) to
 * RedwoodSDK's client-side navigation.
 *
 * @param pathname - The server-rendered pathname, used as the SSR snapshot for
 *   `useSyncExternalStore`. Pass this from a server component that has access
 *   to `requestInfo` so that SSR markup reflects the correct active page.
 */
export function RedwoodProvider({
  children,
  pathname = "/",
}: {
  children: ReactNode;
  pathname?: string;
}) {
  return (
    <PathnameContext.Provider value={pathname}>
      <FrameworkProvider
        usePathname={usePathname}
        useParams={useParams}
        useRouter={useRouter}
        Link={Link}
      >
        {children}
      </FrameworkProvider>
    </PathnameContext.Provider>
  );
}
