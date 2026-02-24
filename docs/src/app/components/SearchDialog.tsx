"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { useEffect, useRef, useState } from "react";
import { HashIcon, SearchIcon, TextIcon } from "@/app/components/ui/Icon";

// --- Result type ---

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  heading?: string;
  pageTitle: string;
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

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const pattern = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  const testPattern = new RegExp(pattern.source, "i");

  return (
    <>
      {parts.map((part, i) =>
        testPattern.test(part) ? (
          <span key={i} className="text-brand-orange underline">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function SearchCommand({
  enableShortcut = false,
}: {
  enableShortcut?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cmd+K shortcut
  useEffect(() => {
    if (!enableShortcut) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enableShortcut]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchValue("");
      setResults([]);
      setIsLoading(false);
    }
  }, [open]);

  function triggerSearch(value: string) {
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Trigger — the search button in the sidebar */}
      <Dialog.Trigger className="flex w-full items-center gap-2 rounded-lg border border-fd-border bg-fd-secondary/50 p-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground">
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-start">Search</span>
      </Dialog.Trigger>

      {/* Popup — portalled search dialog */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm [transition:opacity_150ms] opacity-100 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          className="fixed left-1/2 top-4 md:top-[calc(50%-250px)] z-50 w-[calc(100%-1rem)] max-w-screen-sm -translate-x-1/2 flex flex-col rounded-xl border border-fd-border bg-fd-popover text-fd-popover-foreground shadow-2xl shadow-black/50 overflow-hidden data-[open]:animate-fd-dialog-in data-[closed]:animate-fd-dialog-out"
          aria-label="Search documentation"
        >
          <Autocomplete.Root
            open
            inline
            items={results}
            filter={() => true}
            autoHighlight="always"
            keepHighlight
            itemToStringValue={(item: SearchResult) => item.content}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 p-4">
              <SearchIcon className="size-4 shrink-0 text-fd-muted-foreground" />
              <Autocomplete.Input
                placeholder="Search"
                className="flex-1 bg-transparent text-lg text-fd-muted-foreground outline-none"
                autoFocus
                onInput={(e) =>
                  triggerSearch((e.target as HTMLInputElement).value)
                }
              />
              <Dialog.Close className="rounded uppercase px-1.5 py-0.5 font-mono text-xs text-fd-muted-foreground border border-fd-border hover:bg-fd-accent/50 cursor-pointer transition-opacity">
                Esc
              </Dialog.Close>
            </div>
            {searchValue && (
              <Autocomplete.Separator className="h-px bg-fd-border" />
            )}

            {/* Status — loading / empty */}
            {searchValue && (
              <Autocomplete.Empty className="px-3 py-8 text-center text-sm text-fd-muted-foreground empty:m-0 empty:p-0">
                {isLoading ? (
                  "Searching..."
                ) : (
                  <>No results found for &ldquo;{searchValue}&rdquo;</>
                )}
              </Autocomplete.Empty>
            )}

            {/* Results */}
            <ScrollAreaPrimitive.Root>
              <ScrollAreaPrimitive.Viewport className="max-h-[50vh] overflow-y-auto overscroll-contain mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] [--fade-size:1.5rem]">
                <Autocomplete.List className={"p-2 data-empty:p-0"}>
                  {(result: SearchResult) => (
                    <Autocomplete.Item
                      key={result.id}
                      value={result}
                      onClick={() => {
                        window.location.href = result.url;
                        setOpen(false);
                      }}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-fd-muted-foreground cursor-default data-[highlighted]:bg-fd-accent/50 data-[highlighted]:text-fd-accent-foreground"
                    >
                      <ResultIcon
                        type={result.type}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {result.type !== "page" && result.pageTitle && (
                          <div className="mb-0.5 truncate text-xs text-fd-muted-foreground/70">
                            {result.pageTitle}
                            {result.heading ? ` › ${result.heading}` : ""}
                          </div>
                        )}
                        <div className="truncate">
                          <HighlightMatch
                            text={result.content}
                            query={searchValue}
                          />
                        </div>
                      </div>
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </ScrollAreaPrimitive.Viewport>
              <ScrollAreaPrimitive.Scrollbar
                className="m-1 flex w-1.5 opacity-0 transition-opacity delay-300 data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-100 data-scrolling:duration-100"
                orientation="vertical"
              >
                <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-fd-foreground/20" />
              </ScrollAreaPrimitive.Scrollbar>
            </ScrollAreaPrimitive.Root>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
