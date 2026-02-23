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
import { Autocomplete } from "@base-ui/react/autocomplete";

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearchValue("");
      setResults([]);
      setIsLoading(false);
    }
  }, [open]);

  function handleValueChange(value: string) {
    setSearchValue(value);

    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!value.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?query=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        const data: SearchResult[] = await res.json();
        if (!controller.signal.aborted) {
          setResults(data);
          setIsLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 150);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 [transition:opacity_150ms] opacity-100 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex flex-col items-center px-4 py-[10vh]">
          <Dialog.Popup
            className="flex w-full max-w-lg flex-col rounded-xl border border-fd-border bg-fd-background shadow-2xl [transition:transform_150ms,opacity_150ms] scale-100 opacity-100 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
            aria-label="Search documentation"
          >
            <Autocomplete.Root
              open
              inline
              items={results}
              value={searchValue}
              onValueChange={handleValueChange}
              filter={null}
              autoHighlight="always"
              keepHighlight
              itemToStringValue={(item: SearchResult) => item.content}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-fd-border px-4 py-3">
                <SearchIcon className="size-4 shrink-0 text-fd-muted-foreground" />
                <Autocomplete.Input
                  placeholder="Search documentation..."
                  className="flex-1 bg-transparent text-sm text-fd-foreground placeholder:text-fd-muted-foreground outline-none"
                  autoFocus
                />
                {searchValue && (
                  <Autocomplete.Clear className="rounded px-1.5 py-0.5 text-xs text-fd-muted-foreground border border-fd-border hover:bg-fd-accent/50 cursor-pointer">
                    Clear
                  </Autocomplete.Clear>
                )}
              </div>

              {/* Empty state */}
              <Autocomplete.Empty className="px-3 py-8 text-center text-sm text-fd-muted-foreground">
                {isLoading
                  ? "Searching..."
                  : searchValue
                    ? <>No results found for &ldquo;{searchValue}&rdquo;</>
                    : "Type to search the docs"}
              </Autocomplete.Empty>

              {/* Results */}
              <Autocomplete.List className="max-h-[50vh] overflow-y-auto p-2">
                {(result: SearchResult) => (
                  <Autocomplete.Item
                    key={result.id}
                    value={result}
                    onClick={() => {
                      window.location.href = result.url;
                      onOpenChange(false);
                    }}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-fd-muted-foreground transition-colors data-highlighted:bg-fd-accent/50 data-highlighted:text-fd-accent-foreground cursor-default"
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
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Root>

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
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
