import { RequestInfo } from "rwsdk/worker";
import { ChakraProvider } from "@/app/ChakraProvider";
import { SimpleComponents } from "@/app/components/SimpleComponents";
import { Box, Heading, VStack, Separator, Container } from "@chakra-ui/react";

export function Home({ ctx }: RequestInfo) {
  return (
    <ChakraProvider>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={12} align="stretch">
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
            <Heading as="h2" size="xl" mb={6} data-testid="components-section">
              Basic Components
            </Heading>
            <SimpleComponents />
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}
