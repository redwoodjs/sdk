import {
  Box,
  Button,
  Text,
  Heading,
  VStack,
  HStack,
  Badge,
  Code,
  Kbd,
} from "@chakra-ui/react";

export function SimpleComponents() {
  return (
    <VStack spacing={8} align="stretch">
      {/* Basic Text and Headings */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="text-heading">
          Text & Headings
        </Heading>
        <VStack spacing={2} align="stretch">
          <Heading as="h1" size="xl" data-testid="heading-xl">
            Extra Large Heading
          </Heading>
          <Heading as="h2" size="lg" data-testid="heading-lg">
            Large Heading
          </Heading>
          <Text fontSize="lg" data-testid="text-large">
            This is large text content.
          </Text>
          <Text data-testid="text-normal">This is normal text content.</Text>
        </VStack>
      </Box>

      {/* Buttons */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="button-heading">
          Buttons
        </Heading>
        <HStack spacing={4} wrap="wrap">
          <Button data-testid="button-default">Default Button</Button>
          <Button colorPalette="blue" data-testid="button-blue">
            Blue Button
          </Button>
          <Button variant="outline" data-testid="button-outline">
            Outline Button
          </Button>
          <Button variant="ghost" data-testid="button-ghost">
            Ghost Button
          </Button>
          <Button size="sm" data-testid="button-small">
            Small
          </Button>
          <Button size="lg" data-testid="button-large">
            Large
          </Button>
        </HStack>
      </Box>

      {/* Badges */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="badge-heading">
          Badges
        </Heading>
        <HStack spacing={4} wrap="wrap">
          <Badge data-testid="badge-default">Default</Badge>
          <Badge colorPalette="green" data-testid="badge-green">
            Success
          </Badge>
          <Badge colorPalette="red" data-testid="badge-red">
            Error
          </Badge>
          <Badge colorPalette="blue" data-testid="badge-blue">
            Info
          </Badge>
          <Badge
            variant="outline"
            colorPalette="purple"
            data-testid="badge-outline"
          >
            Outline
          </Badge>
        </HStack>
      </Box>

      {/* Code and Kbd */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="code-heading">
          Code & Keyboard
        </Heading>
        <VStack spacing={4} align="stretch">
          <Text data-testid="inline-code">
            Use the <Code>console.log()</Code> function to debug your code.
          </Text>

          <Text data-testid="keyboard-shortcuts">
            Press <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to copy and <Kbd>Ctrl</Kbd> +{" "}
            <Kbd>V</Kbd> to paste.
          </Text>

          <Code
            display="block"
            whiteSpace="pre"
            p={4}
            borderRadius="md"
            data-testid="code-block"
          >
            {`function greet(name) {
  return \`Hello, \${name}!\`;
}`}
          </Code>
        </VStack>
      </Box>

      {/* Layout */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="layout-heading">
          Layout
        </Heading>
        <VStack spacing={4}>
          <Box
            bg="blue.500"
            color="white"
            p={4}
            borderRadius="md"
            data-testid="colored-box"
          >
            This is a colored Box component
          </Box>

          <HStack spacing={4} data-testid="horizontal-stack">
            <Box bg="red.200" p={2} borderRadius="md">
              Item 1
            </Box>
            <Box bg="green.200" p={2} borderRadius="md">
              Item 2
            </Box>
            <Box bg="blue.200" p={2} borderRadius="md">
              Item 3
            </Box>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
