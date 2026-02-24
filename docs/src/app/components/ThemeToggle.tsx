"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Switch } from "@base-ui/react/switch";
import { setTheme } from "@/app/actions/setTheme";
import { MoonIcon, SunIcon } from "@/app/components/ui/Icon";

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
