import { RequestInfo } from "rwsdk/worker";
import { ChakraProvider } from "@/app/ChakraProvider";
import {
  Box,
  Container,
  Heading,
  Text,
} from "@chakra-ui/react";
import { Section, SectionTitle, SectionContent } from "../components/Layout";
import { ButtonDemo } from "../components/ButtonDemo";
import { BadgeDemo } from "../components/BadgeDemo";
import { CodeDemo } from "../components/CodeDemo";
import { KbdDemo } from "../components/KbdDemo";

export function Home({ ctx }: RequestInfo) {
  return (
    <ChakraProvider>
      <Container display="flex" gap="10" maxW="8xl">
        <Box
          maxW="5xl"
          width="full"
          flex="1"
          minHeight="var(--content-height)"
          overflow="auto"
          mx="auto"
        >
          <Box textAlign="center" py="8" mb="8">
            <Heading as="h1" size="2xl" mb={4} data-testid="main-title">
              Chakra UI Playground
            </Heading>
            <Text fontSize="lg" color="fg.muted" data-testid="subtitle">
              Component showcase for RedwoodSDK with Chakra UI
            </Text>
          </Box>

          <Section>
            <SectionTitle id="button">Button</SectionTitle>
            <SectionContent>
              <ButtonDemo />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="badge">Badge</SectionTitle>
            <SectionContent>
              <BadgeDemo />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="code">Code</SectionTitle>
            <SectionContent>
              <CodeDemo />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="kbd">Keyboard</SectionTitle>
            <SectionContent>
              <KbdDemo />
            </SectionContent>
          </Section>
        </Box>
      </Container>
    </ChakraProvider>
  );
}
