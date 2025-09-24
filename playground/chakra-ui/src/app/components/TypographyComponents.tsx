import { Heading, Text, VStack } from "@chakra-ui/react";

export function TypographyComponents() {
  return (
    <VStack gap={4} alignItems="flex-start">
      <Heading as="h1" size="4xl" data-testid="heading-4xl">
        Heading 4xl
      </Heading>
      <Heading as="h2" size="2xl">
        Heading 2xl
      </Heading>
      <Heading as="h3" size="lg">
        Heading lg
      </Heading>
      <Text fontSize="xl">This is extra large text.</Text>
      <Text>This is default size text.</Text>
      <Text fontSize="sm" color="gray.500">
        This is small, gray text.
      </Text>
    </VStack>
  );
}
