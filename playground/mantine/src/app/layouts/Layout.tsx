import { MantineProvider } from "@mantine/core";

export function Layout({ children }: { children: React.ReactNode }) {
  "use client";
  return <MantineProvider>{children}</MantineProvider>;
}
