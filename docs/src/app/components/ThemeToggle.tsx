"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type InitialTheme = "dark" | "light" | "system" | undefined;
import { Switch } from "@base-ui/react/switch";
import { setTheme } from "@/app/actions/setTheme";

type Theme = "dark" | "light";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggle({ initialTheme }: { initialTheme?: InitialTheme }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    initialTheme === "dark" ? "dark" : "light"
  );
  const isInitialMount = useRef(true);

  useEffect(() => {
    const root = document.documentElement;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Sync React state with the DOM — the blocking script in Document.tsx
      // already resolved "system" preference and set the correct class.
      const isDark = root.classList.contains("dark");
      if ((isDark ? "dark" : "light") !== theme) {
        setThemeState(isDark ? "dark" : "light");
      }
      return;
    }

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    setTheme(theme).catch((error) => {
      console.error("Failed to set theme:", error);
    });
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <Switch.Root
      checked={isDark}
      onCheckedChange={(checked) =>
        setThemeState(checked ? "dark" : "light")
      }
      aria-label="Toggle theme"
      className="ms-auto relative flex h-8 w-16 cursor-pointer items-center rounded-full border border-fd-border bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-1"
    >
      {/* Sliding highlight — covers exactly half the pill */}
      <Switch.Thumb className="pointer-events-none absolute left-0 top-0 h-full w-1/2 rounded-full bg-fd-accent transition-transform duration-200 ease-in-out data-[checked]:translate-x-full" />

      {/* Sun (light mode, left) */}
      <span className="relative z-10 flex h-full w-1/2 items-center justify-center">
        <SunIcon
          className={clsx(
            "size-3.5 transition-colors duration-200",
            isDark ? "text-fd-muted-foreground" : "text-fd-accent-foreground",
          )}
        />
      </span>

      {/* Moon (dark mode, right) */}
      <span className="relative z-10 flex h-full w-1/2 items-center justify-center">
        <MoonIcon
          className={clsx(
            "size-3.5 transition-colors duration-200",
            isDark ? "text-fd-accent-foreground" : "text-fd-muted-foreground",
          )}
        />
      </span>
    </Switch.Root>
  );
}
