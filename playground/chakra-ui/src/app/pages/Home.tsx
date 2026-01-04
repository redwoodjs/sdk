import { RequestInfo } from "rwsdk/worker";
import { ChakraProvider } from "@/app/ChakraProvider";
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Button,
  Badge,
  Code,
  Kbd,
  Text,
  Flex,
  Stack,
} from "@chakra-ui/react";
import * as React from "react"

const Section = ({ children }: { children: React.ReactNode }) => {
  return (
    <Flex direction="column" gap="5" mb={{ base: "5", sm: "8" }}>
      {children}
    </Flex>
  );
};

interface SectionTitleProps {
  children: React.ReactNode;
  id: string;
}

const SectionTitle = ({ children, id }: SectionTitleProps) => {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="4"
      mt="2"
      bg="bg.muted"
      px="4"
      py="3"
      rounded="md"
      colorPalette="gray"
      textStyle="sm"
    >
      <Text fontWeight="medium" id={id}>
        {children}
      </Text>
    </Flex>
  );
};

const SectionContent = (props: any) => {
  return <Stack gap="8" {...props} />;
};

interface DemoListProps {
  items: Array<{
    label: string;
    component: JSX.Element;
  }>;
}

const DemoList = (props: DemoListProps) => {
  const { items } = props;
  return (
    <>
      {items.map(({ label, component }) => (
        <Stack key={label} align="flex-start" gap="5">
          <Text color="fg.muted" textStyle="sm" fontWeight="medium">
            {label}
          </Text>
          {component}
        </Stack>
      ))}
    </>
  );
};

export function Home({ ctx }: RequestInfo) {
  const buttonVariants = ["solid", "outline", "ghost", "subtle"] as const;
  const badgeVariants = ["solid", "outline", "subtle"] as const;
  const codeVariants = ["subtle", "surface", "outline", "solid"] as const;

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
              RedwoodSDK Playground
            </Heading>
            <Text fontSize="lg" color="fg.muted" data-testid="subtitle">
              Component showcase for RedwoodSDK with Chakra UI
            </Text>
          </Box>

          <Section>
            <SectionTitle id="button">Button</SectionTitle>
            <SectionContent>
              <DemoList
                items={[
                  {
                    label: "Accent Colors",
                    component: (
                      <HStack wrap="wrap">
                        {buttonVariants.map((variant) => (
                          <Button key={variant} variant={variant}>
                            Click me
                          </Button>
                        ))}
                      </HStack>
                    ),
                  },
                  {
                    label: "Color Schemes",
                    component: (
                      <HStack wrap="wrap">
                        <Button colorScheme="blue" data-testid="button-solid">
                          Blue
                        </Button>
                        <Button colorScheme="teal">Teal</Button>
                        <Button colorScheme="pink">Pink</Button>
                        <Button colorScheme="purple">Purple</Button>
                      </HStack>
                    ),
                  },
                ]}
              />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="badge">Badge</SectionTitle>
            <SectionContent>
              <DemoList
                items={[
                  {
                    label: "Variants",
                    component: (
                      <HStack wrap="wrap" gap="4">
                        {badgeVariants.map((variant) => (
                          <Badge
                            key={variant}
                            variant={variant}
                            colorScheme="green"
                          >
                            {variant}
                          </Badge>
                        ))}
                      </HStack>
                    ),
                  },
                  {
                    label: "Color Schemes",
                    component: (
                      <HStack wrap="wrap" gap="4">
                        <Badge colorScheme="green" data-testid="badge-default">
                          Success
                        </Badge>
                        <Badge colorScheme="red" variant="solid">
                          Error
                        </Badge>
                        <Badge colorScheme="purple" variant="outline">
                          Info
                        </Badge>
                        <Badge colorScheme="orange" variant="subtle">
                          Warning
                        </Badge>
                      </HStack>
                    ),
                  },
                ]}
              />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="code">Code</SectionTitle>
            <SectionContent>
              <DemoList
                items={[
                  {
                    label: "Variants",
                    component: (
                      <HStack wrap="wrap" gap="4">
                        {codeVariants.map((variant) => (
                          <Code key={variant} variant={variant} size="md">
                            console.log()
                          </Code>
                        ))}
                      </HStack>
                    ),
                  },
                  {
                    label: "Examples",
                    component: (
                      <VStack align="flex-start" gap="3">
                        <Code>const greeting = "Hello, World!"</Code>
                        <Code>function sum(a, b) {"{ return a + b }"}</Code>
                        <Code colorScheme="red">Error: undefined</Code>
                      </VStack>
                    ),
                  },
                ]}
              />
            </SectionContent>
          </Section>

          <Section>
            <SectionTitle id="kbd">Keyboard</SectionTitle>
            <SectionContent>
              <DemoList
                items={[
                  {
                    label: "Shortcuts",
                    component: (
                      <HStack wrap="wrap" gap="4">
                        <HStack>
                          <Kbd>⌘</Kbd>
                          <Text>+</Text>
                          <Kbd>C</Kbd>
                        </HStack>
                        <HStack>
                          <Kbd>Ctrl</Kbd>
                          <Text>+</Text>
                          <Kbd>V</Kbd>
                        </HStack>
                        <HStack>
                          <Kbd>Shift</Kbd>
                          <Text>+</Text>
                          <Kbd>Enter</Kbd>
                        </HStack>
                      </HStack>
                    ),
                  },
                  {
                    label: "Sizes",
                    component: (
                      <HStack gap="4">
                        <Kbd size="sm">⌘ K</Kbd>
                        <Kbd size="md">⌘ K</Kbd>
                        <Kbd size="lg">⌘ K</Kbd>
                      </HStack>
                    ),
                  },
                ]}
              />
            </SectionContent>
          </Section>
        </Box>
      </Container>
    </ChakraProvider>
  );
}