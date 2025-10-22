import { MantineProvider } from "@mantine/core";
import type { LayoutProps } from "rwsdk/router";

export function MantineLayout({ children }: LayoutProps) {
  "use client";
  return <MantineProvider>{children}</MantineProvider>;
}
