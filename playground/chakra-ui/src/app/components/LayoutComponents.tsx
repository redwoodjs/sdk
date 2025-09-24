import {
  Box,
  Grid,
  GridItem,
  HStack,
  SimpleGrid,
  VStack,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";

export function LayoutComponents() {
  return (
    <VStack gap={8} alignItems="flex-start">
      <Box>
        <Text fontSize="xl" mb={4}>
          VStack and HStack
        </Text>
        <HStack gap={4} data-testid="box-example">
          <VStack gap={2} bg="gray.100" p={4} borderRadius="md">
            <Box bg="blue.200" p={2} borderRadius="md">
              VStack Item 1
            </Box>
            <Box bg="blue.300" p={2} borderRadius="md">
              VStack Item 2
            </Box>
          </VStack>
          <HStack gap={2} bg="gray.100" p={4} borderRadius="md">
            <Box bg="green.200" p={2} borderRadius="md">
              HStack Item 1
            </Box>
            <Box bg="green.300" p={2} borderRadius="md">
              HStack Item 2
            </Box>
          </HStack>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="xl" mb={4}>
          SimpleGrid
        </Text>
        <SimpleGrid columns={3} gap={4}>
          <Box bg="purple.200" h="80px" borderRadius="md"></Box>
          <Box bg="purple.300" h="80px" borderRadius="md"></Box>
          <Box bg="purple.400" h="80px" borderRadius="md"></Box>
          <Box bg="purple.500" h="80px" borderRadius="md"></Box>
          <Box bg="purple.600" h="80px" borderRadius="md"></Box>
        </SimpleGrid>
      </Box>

      <Box>
        <Text fontSize="xl" mb={4}>
          Grid with GridItem
        </Text>
        <Grid
          h="200px"
          templateRows="repeat(2, 1fr)"
          templateColumns="repeat(5, 1fr)"
          gap={4}
        >
          <GridItem rowSpan={2} colSpan={1} bg="orange.200" borderRadius="md" />
          <GridItem colSpan={2} bg="orange.300" borderRadius="md" />
          <GridItem colSpan={2} bg="orange.400" borderRadius="md" />
          <GridItem colSpan={4} bg="orange.500" borderRadius="md" />
        </Grid>
      </Box>

      <Box>
        <Text fontSize="xl" mb={4}>
          Wrap with WrapItem
        </Text>
        <Wrap gap={4}>
          <WrapItem>
            <Box w="150px" h="80px" bg="red.200" borderRadius="md"></Box>
          </WrapItem>
          <WrapItem>
            <Box w="150px" h="80px" bg="red.300" borderRadius="md"></Box>
          </WrapItem>
          <WrapItem>
            <Box w="150px" h="80px" bg="red.400" borderRadius="md"></Box>
          </WrapItem>
          <WrapItem>
            <Box w="150px" h="80px" bg="red.500" borderRadius="md"></Box>
          </WrapItem>
        </Wrap>
      </Box>
    </VStack>
  );
}
