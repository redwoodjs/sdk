import {
  Badge,
  Box,
  Button,
  Code,
  HStack,
  Kbd,
  VStack,
} from "@chakra-ui/react";

export function SimpleComponents() {
  return (
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
        <Button variant="link" colorScheme="purple">
          Link Button
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
  );
}
