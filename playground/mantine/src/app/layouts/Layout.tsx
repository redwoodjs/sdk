import { MantineProvider } from "@mantine/core";
import type { LayoutProps } from "rwsdk/worker";

export function Layout({ children }: LayoutProps) {
  "use client";
  return <MantineProvider>{children}</MantineProvider>;
}
