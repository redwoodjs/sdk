"use client";
import { MantineProvider } from "@mantine/core";
import type { LayoutProps } from "rwsdk/worker";

export function Layout({ children }: LayoutProps) {
  return <MantineProvider>{children}</MantineProvider>;
}
