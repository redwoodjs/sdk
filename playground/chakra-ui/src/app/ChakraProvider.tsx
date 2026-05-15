"use client";

import {
  ChakraProvider as ChakraUIProvider,
  defaultSystem,
} from "@chakra-ui/react";

export function ChakraProvider({ children }: { children: React.ReactNode }) {
  return <ChakraUIProvider value={defaultSystem}>{children}</ChakraUIProvider>;
}
