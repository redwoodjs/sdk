import { RequestInfo } from "rwsdk/worker";
import { ChakraProvider } from "@/app/ChakraProvider";
import { Box, Container, Divider, Heading, VStack } from "@chakra-ui/react";

import { DataDisplayComponents } from "@/app/components/DataDisplayComponents";
import { FeedbackComponents } from "@/app/components/FeedbackComponents";
import { FormComponents } from "@/app/components/FormComponents";
import { LayoutComponents } from "@/app/components/LayoutComponents";
import { MediaComponents } from "@/app/components/MediaComponents";
import { NavigationComponents } from "@/app/components/NavigationComponents";
import { OverlayComponents } from "@/app/components/OverlayComponents";
import { SimpleComponents } from "@/app/components/SimpleComponents";
import { TypographyComponents } from "@/app/components/TypographyComponents";

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
              Comprehensive component showcase for RedwoodSDK
            </Heading>
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Simple Components
            </Heading>
            <SimpleComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Layout Components
            </Heading>
            <LayoutComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Form Components
            </Heading>
            <FormComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Data Display Components
            </Heading>
            <DataDisplayComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Feedback Components
            </Heading>
            <FeedbackComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Typography Components
            </Heading>
            <TypographyComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Overlay Components
            </Heading>
            <OverlayComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Media Components
            </Heading>
            <MediaComponents />
          </Box>

          <Divider />

          <Box>
            <Heading as="h2" size="xl" mb={6}>
              Navigation Components
            </Heading>
            <NavigationComponents />
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}
