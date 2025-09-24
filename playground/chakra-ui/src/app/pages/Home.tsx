import { RequestInfo } from "rwsdk/worker";
import { ChakraProvider } from "@/app/ChakraProvider";
import {
  Box,
  Container,
  Separator,
  Heading,
  VStack,
  HStack,
  Button,
  Badge,
  Code,
  Kbd,
} from "@chakra-ui/react";

export function Home({ ctx }: RequestInfo) {
  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={8}>
        <VStack gap={12} align="stretch">
          <Box textAlign="center">
            <Heading as="h1" size="2xl" mb={4} data-testid="main-title">
              Chakra UI Playground
            </Heading>
            <Heading as="h2" size="lg" color="gray.600" data-testid="subtitle">
              Basic component showcase for RedwoodSDK
            </Heading>
          </Box>

          <Separator />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Simple Components
            </Heading>
            <VStack gap={4} alignItems="flex-start">
              <HStack gap={4}>
                <Button colorScheme="blue" data-testid="button-solid">
                  Solid Button
                </Button>
                <Button variant="outline" colorScheme="teal">
                  Outline Button
                </Button>
                <Button variant="ghost" colorScheme="pink">
                  Ghost Button
                </Button>
              </HStack>
              <HStack gap={4}>
                <Badge colorScheme="green" data-testid="badge-default">
                  Default Badge
                </Badge>
                <Badge colorScheme="red" variant="solid">
                  Solid Badge
                </Badge>
                <Badge colorScheme="purple" variant="outline">
                  Outline Badge
                </Badge>
              </HStack>
              <HStack gap={4}>
                <Code>console.log("Hello, World!")</Code>
                <Kbd>Ctrl</Kbd>+<Kbd>C</Kbd>
              </HStack>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}
