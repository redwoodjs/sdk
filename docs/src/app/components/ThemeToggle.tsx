"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Switch } from "@base-ui/react/switch";
import { setTheme } from "@/app/actions/setTheme";

type Theme = "dark" | "light";

function disableTransitions(): () => void {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      "*:not([data-theme-toggle]):not([data-theme-toggle] *),*:not([data-theme-toggle]):not([data-theme-toggle] *)::before,*:not([data-theme-toggle]):not([data-theme-toggle] *)::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(css);

  return () => {
    // Force restyle
    window.getComputedStyle(document.body);
    // Remove on next tick
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
}

function resolveInitialTheme(
  preference: "dark" | "light" | "system" | undefined,
): Theme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  // For "system" or undefined, read the class that the blocking script in
  // Document.tsx already set based on the OS preference.
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }
  return "light";
}

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

export function ThemeToggle({
  initialTheme,
}: {
  initialTheme?: "dark" | "light" | "system";
}) {
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveInitialTheme(initialTheme),
  );
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip persisting on the initial mount — the blocking script in
    // Document.tsx already applied the correct class.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const restore = disableTransitions();
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    restore();

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
      data-theme-toggle=""
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
