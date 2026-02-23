"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "@base-ui/react/dialog";

// --- Search context ---

const SearchContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
      <SearchDialogInner open={open} onOpenChange={setOpen} />
    </SearchContext.Provider>
  );
}

// --- Result type ---

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  pageTitle: string;
}

// --- Icons ---

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 6.1H3" />
      <path d="M21 12.1H3" />
      <path d="M15.1 18H3" />
    </svg>
  );
}

function ResultIcon({
  type,
  className,
}: {
  type: SearchResult["type"];
  className?: string;
}) {
  switch (type) {
    case "page":
      return <SearchIcon className={className} />;
    case "heading":
      return <HashIcon className={className} />;
    case "text":
      return <TextIcon className={className} />;
  }
}

// --- Dialog ---

function SearchDialogInner({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced fetch
  useEffect(() => {
    if (!search) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?query=${encodeURIComponent(search)}`,
          { signal: controller.signal },
        );
        const data: SearchResult[] = await res.json();
        setResults(data);
      } catch {
        // Aborted or network error
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector("[data-active=true]");
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      window.location.href = results[activeIndex].url;
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 [transition:opacity_150ms] opacity-100 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-fd-border bg-fd-background shadow-2xl [transition:transform_150ms,opacity_150ms] scale-100 opacity-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-fd-border px-4 py-3">
            <SearchIcon className="size-4 shrink-0 text-fd-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documentation..."
              className="flex-1 bg-transparent text-sm text-fd-foreground placeholder:text-fd-muted-foreground outline-none"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded px-1.5 py-0.5 text-xs text-fd-muted-foreground border border-fd-border hover:bg-fd-accent/50"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {isLoading && search && (
              <p className="px-3 py-8 text-center text-sm text-fd-muted-foreground">
                Searching...
              </p>
            )}

            {!isLoading && search && results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-fd-muted-foreground">
                No results found for &ldquo;{search}&rdquo;
              </p>
            )}

            {!search && (
              <p className="px-3 py-8 text-center text-sm text-fd-muted-foreground">
                Type to search the docs
              </p>
            )}

            {results.map((result, i) => (
              <a
                key={result.id}
                href={result.url}
                data-active={i === activeIndex}
                onClick={() => onOpenChange(false)}
                onMouseEnter={() => setActiveIndex(i)}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 data-[active=true]:bg-fd-accent/50 data-[active=true]:text-fd-accent-foreground"
              >
                <ResultIcon
                  type={result.type}
                  className="mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  {result.type !== "page" && result.pageTitle && (
                    <div className="mb-0.5 truncate text-xs text-fd-muted-foreground/70">
                      {result.pageTitle}
                    </div>
                  )}
                  <div className="truncate">{result.content}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-fd-border bg-fd-secondary/50 px-1.5 py-0.5 font-mono">
                ↑↓
              </kbd>
              <span>Navigate</span>
              <kbd className="rounded border border-fd-border bg-fd-secondary/50 px-1.5 py-0.5 font-mono">
                ↵
              </kbd>
              <span>Open</span>
              <kbd className="rounded border border-fd-border bg-fd-secondary/50 px-1.5 py-0.5 font-mono">
                Esc
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
