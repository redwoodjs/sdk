"use client";

import { system } from "@/theme";
import {
  ChakraProvider as ChakraUIProvider,
} from "@chakra-ui/react";

export function ChakraProvider({ children }: { children: React.ReactNode }) {
  return <ChakraUIProvider value={system}>{children}</ChakraUIProvider>;
}
