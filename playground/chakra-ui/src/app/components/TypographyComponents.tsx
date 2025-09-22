import {
  Text,
  Heading,
  Highlight,
  Mark,
  Box,
  VStack,
  HStack,
  SimpleGrid,
  Code,
  Kbd,
} from "@chakra-ui/react";

export function TypographyComponents() {
  return (
    <VStack spacing={8} align="stretch">
      {/* Heading */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="heading-section-title">
          Heading
        </Heading>
        <VStack spacing={3} align="stretch">
          <Heading as="h1" size="4xl" data-testid="heading-4xl">
            Heading 4XL (h1)
          </Heading>
          <Heading as="h2" size="3xl" data-testid="heading-3xl">
            Heading 3XL (h2)
          </Heading>
          <Heading as="h3" size="2xl" data-testid="heading-2xl">
            Heading 2XL (h3)
          </Heading>
          <Heading as="h4" size="xl" data-testid="heading-xl">
            Heading XL (h4)
          </Heading>
          <Heading as="h5" size="lg" data-testid="heading-lg">
            Heading LG (h5)
          </Heading>
          <Heading as="h6" size="md" data-testid="heading-md">
            Heading MD (h6)
          </Heading>
          <Heading as="h6" size="sm" data-testid="heading-sm">
            Heading SM
          </Heading>
          <Heading as="h6" size="xs" data-testid="heading-xs">
            Heading XS
          </Heading>
        </VStack>
      </Box>

      {/* Text */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="text-section-title">
          Text
        </Heading>
        <VStack spacing={4} align="stretch">
          {/* Text Sizes */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Text Sizes
            </Text>
            <VStack spacing={2} align="stretch">
              <Text fontSize="6xl" data-testid="text-6xl">
                6XL Text
              </Text>
              <Text fontSize="5xl" data-testid="text-5xl">
                5XL Text
              </Text>
              <Text fontSize="4xl" data-testid="text-4xl">
                4XL Text
              </Text>
              <Text fontSize="3xl" data-testid="text-3xl">
                3XL Text
              </Text>
              <Text fontSize="2xl" data-testid="text-2xl">
                2XL Text
              </Text>
              <Text fontSize="xl" data-testid="text-xl">
                XL Text
              </Text>
              <Text fontSize="lg" data-testid="text-lg">
                Large Text
              </Text>
              <Text fontSize="md" data-testid="text-md">
                Medium Text (default)
              </Text>
              <Text fontSize="sm" data-testid="text-sm">
                Small Text
              </Text>
              <Text fontSize="xs" data-testid="text-xs">
                Extra Small Text
              </Text>
            </VStack>
          </Box>

          {/* Text Weights */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Text Weights
            </Text>
            <VStack spacing={2} align="stretch">
              <Text fontWeight="hairline" data-testid="text-hairline">
                Hairline (100)
              </Text>
              <Text fontWeight="thin" data-testid="text-thin">
                Thin (200)
              </Text>
              <Text fontWeight="light" data-testid="text-light">
                Light (300)
              </Text>
              <Text fontWeight="normal" data-testid="text-normal">
                Normal (400)
              </Text>
              <Text fontWeight="medium" data-testid="text-medium">
                Medium (500)
              </Text>
              <Text fontWeight="semibold" data-testid="text-semibold">
                Semibold (600)
              </Text>
              <Text fontWeight="bold" data-testid="text-bold">
                Bold (700)
              </Text>
              <Text fontWeight="extrabold" data-testid="text-extrabold">
                Extra Bold (800)
              </Text>
              <Text fontWeight="black" data-testid="text-black">
                Black (900)
              </Text>
            </VStack>
          </Box>

          {/* Text Colors */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Text Colors
            </Text>
            <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2}>
              <Text color="red.500" data-testid="text-red">
                Red Text
              </Text>
              <Text color="green.500" data-testid="text-green">
                Green Text
              </Text>
              <Text color="blue.500" data-testid="text-blue">
                Blue Text
              </Text>
              <Text color="purple.500" data-testid="text-purple">
                Purple Text
              </Text>
              <Text color="orange.500" data-testid="text-orange">
                Orange Text
              </Text>
              <Text color="teal.500" data-testid="text-teal">
                Teal Text
              </Text>
              <Text color="pink.500" data-testid="text-pink">
                Pink Text
              </Text>
              <Text color="cyan.500" data-testid="text-cyan">
                Cyan Text
              </Text>
              <Text color="gray.500" data-testid="text-gray">
                Gray Text
              </Text>
            </SimpleGrid>
          </Box>

          {/* Text Decorations */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Text Decorations
            </Text>
            <VStack spacing={2} align="stretch">
              <Text textDecoration="underline" data-testid="text-underline">
                Underlined Text
              </Text>
              <Text
                textDecoration="line-through"
                data-testid="text-strikethrough"
              >
                Strikethrough Text
              </Text>
              <Text textTransform="uppercase" data-testid="text-uppercase">
                Uppercase Text
              </Text>
              <Text textTransform="lowercase" data-testid="text-lowercase">
                LOWERCASE TEXT
              </Text>
              <Text textTransform="capitalize" data-testid="text-capitalize">
                capitalized text
              </Text>
            </VStack>
          </Box>

          {/* Text Alignment */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Text Alignment
            </Text>
            <VStack spacing={2} align="stretch">
              <Text textAlign="left" data-testid="text-align-left">
                Left aligned text
              </Text>
              <Text textAlign="center" data-testid="text-align-center">
                Center aligned text
              </Text>
              <Text textAlign="right" data-testid="text-align-right">
                Right aligned text
              </Text>
              <Text textAlign="justify" data-testid="text-align-justify">
                Justified text that spans multiple lines to demonstrate how text
                justification works in Chakra UI components when dealing with
                longer content.
              </Text>
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* Highlight */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="highlight-section-title">
          Highlight
        </Heading>
        <VStack spacing={4} align="stretch">
          <Text data-testid="highlight-basic">
            <Highlight
              query="spotlight"
              styles={{ px: "2", py: "1", rounded: "full", bg: "red.100" }}
            >
              With the Highlight component, you can spotlight words.
            </Highlight>
          </Text>

          <Text data-testid="highlight-multiple">
            <Highlight
              query={["spotlight", "emphasize", "Acme"]}
              styles={{ px: "1", py: "1", bg: "orange.100" }}
            >
              The Highlight component can spotlight multiple words, emphasize
              important terms, and make your Acme brand stand out.
            </Highlight>
          </Text>

          <Text data-testid="highlight-colored">
            <Highlight
              query="amazing"
              styles={{
                px: "2",
                py: "1",
                rounded: "full",
                bg: "blue.100",
                color: "blue.800",
              }}
            >
              This is an amazing feature that makes text highlighting easy and
              customizable.
            </Highlight>
          </Text>
        </VStack>
      </Box>

      {/* Mark */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="mark-section-title">
          Mark
        </Heading>
        <VStack spacing={3} align="stretch">
          <Text data-testid="mark-basic">
            Most <Mark>important</Mark> part of the sentence.
          </Text>

          <Text data-testid="mark-colored">
            The{" "}
            <Mark bg="green.200" color="green.800">
              green highlighted
            </Mark>{" "}
            text stands out.
          </Text>

          <Text data-testid="mark-multiple">
            You can have <Mark bg="yellow.200">multiple</Mark> marked{" "}
            <Mark bg="pink.200">sections</Mark> in the same text.
          </Text>
        </VStack>
      </Box>

      {/* Inline Code and Keyboard */}
      <Box>
        <Heading
          as="h3"
          size="md"
          mb={4}
          data-testid="inline-elements-section-title"
        >
          Inline Elements
        </Heading>
        <VStack spacing={3} align="stretch">
          <Text data-testid="inline-code">
            Use the <Code>console.log()</Code> function to debug your code.
          </Text>

          <Text data-testid="inline-kbd">
            Press <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to copy and <Kbd>Ctrl</Kbd> +{" "}
            <Kbd>V</Kbd> to paste.
          </Text>

          <Text data-testid="mixed-inline">
            Run <Code>npm install</Code> and then press <Kbd>Enter</Kbd> to{" "}
            <Mark>install</Mark> the dependencies.
          </Text>
        </VStack>
      </Box>

      {/* Text Truncation */}
      <Box>
        <Heading
          as="h3"
          size="md"
          mb={4}
          data-testid="truncation-section-title"
        >
          Text Truncation
        </Heading>
        <VStack spacing={3} align="stretch">
          <Text isTruncated maxW="300px" data-testid="text-truncated">
            This is a very long text that will be truncated when it exceeds the
            maximum width of its container.
          </Text>

          <Text noOfLines={2} data-testid="text-lines-limited">
            This is a longer paragraph that demonstrates the noOfLines prop. It
            will show only the first two lines and truncate the rest with an
            ellipsis. This is useful for creating consistent layouts when
            dealing with variable content lengths.
          </Text>
        </VStack>
      </Box>

      {/* Responsive Text */}
      <Box>
        <Heading
          as="h3"
          size="md"
          mb={4}
          data-testid="responsive-section-title"
        >
          Responsive Typography
        </Heading>
        <VStack spacing={3} align="stretch">
          <Text
            fontSize={{ base: "sm", md: "md", lg: "lg" }}
            data-testid="responsive-text"
          >
            This text changes size based on screen size: small on mobile, medium
            on tablet, large on desktop.
          </Text>

          <Heading
            size={{ base: "md", md: "lg", lg: "xl" }}
            data-testid="responsive-heading"
          >
            Responsive Heading
          </Heading>
        </VStack>
      </Box>
    </VStack>
  );
}
