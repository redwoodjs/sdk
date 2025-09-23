import {
  Box,
  Flex,
  Grid,
  GridItem,
  Stack,
  HStack,
  VStack,
  Wrap,
  WrapItem,
  Center,
  Square,
  Circle,
  Container,
  SimpleGrid,
  Spacer,
  AspectRatio,
  Text,
  Heading,
} from "@chakra-ui/react";

export function LayoutComponents() {
  return (
    <VStack spacing={8} align="stretch">
      {/* Box Component */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="box-heading">
          Box
        </Heading>
        <Box
          bg="blue.500"
          color="white"
          p={4}
          borderRadius="md"
          data-testid="box-example"
        >
          This is a Box component with blue background
        </Box>
      </Box>

      {/* Flex Component */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="flex-heading">
          Flex
        </Heading>
        <Flex
          bg="gray.100"
          p={4}
          borderRadius="md"
          justify="space-between"
          align="center"
          data-testid="flex-example"
        >
          <Box bg="red.500" color="white" p={2} borderRadius="md">
            Item 1
          </Box>
          <Box bg="green.500" color="white" p={2} borderRadius="md">
            Item 2
          </Box>
          <Box bg="blue.500" color="white" p={2} borderRadius="md">
            Item 3
          </Box>
        </Flex>
      </Box>

      {/* Grid Component */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="grid-heading">
          Grid
        </Heading>
        <Grid
          templateColumns="repeat(3, 1fr)"
          gap={4}
          data-testid="grid-example"
        >
          <GridItem bg="purple.500" color="white" p={4} borderRadius="md">
            Grid Item 1
          </GridItem>
          <GridItem bg="orange.500" color="white" p={4} borderRadius="md">
            Grid Item 2
          </GridItem>
          <GridItem bg="teal.500" color="white" p={4} borderRadius="md">
            Grid Item 3
          </GridItem>
        </Grid>
      </Box>

      {/* Stack Components */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="stack-heading">
          Stack (VStack & HStack)
        </Heading>
        <VStack spacing={4} data-testid="vstack-example">
          <HStack spacing={4} data-testid="hstack-example">
            <Box bg="pink.500" color="white" p={2} borderRadius="md">
              HStack Item 1
            </Box>
            <Box bg="cyan.500" color="white" p={2} borderRadius="md">
              HStack Item 2
            </Box>
          </HStack>
          <Box bg="yellow.500" color="black" p={2} borderRadius="md">
            VStack Item
          </Box>
        </VStack>
      </Box>

      {/* Wrap Component */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="wrap-heading">
          Wrap
        </Heading>
        <Wrap spacing={4} data-testid="wrap-example">
          <WrapItem>
            <Box bg="red.400" color="white" p={2} borderRadius="md">
              Wrap Item 1
            </Box>
          </WrapItem>
          <WrapItem>
            <Box bg="green.400" color="white" p={2} borderRadius="md">
              Wrap Item 2
            </Box>
          </WrapItem>
          <WrapItem>
            <Box bg="blue.400" color="white" p={2} borderRadius="md">
              Wrap Item 3
            </Box>
          </WrapItem>
          <WrapItem>
            <Box bg="purple.400" color="white" p={2} borderRadius="md">
              Wrap Item 4
            </Box>
          </WrapItem>
        </Wrap>
      </Box>

      {/* Center, Square, Circle */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="center-heading">
          Center, Square & Circle
        </Heading>
        <HStack spacing={4}>
          <Center
            bg="gray.200"
            h="100px"
            w="100px"
            borderRadius="md"
            data-testid="center-example"
          >
            Center
          </Center>
          <Square
            bg="red.200"
            size="100px"
            borderRadius="md"
            data-testid="square-example"
          >
            <Text>Square</Text>
          </Square>
          <Circle bg="blue.200" size="100px" data-testid="circle-example">
            <Text>Circle</Text>
          </Circle>
        </HStack>
      </Box>

      {/* Container */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="container-heading">
          Container
        </Heading>
        <Container
          maxW="md"
          bg="gray.100"
          p={4}
          borderRadius="md"
          data-testid="container-example"
        >
          This is a Container component with max width of 'md'
        </Container>
      </Box>

      {/* SimpleGrid */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="simple-grid-heading">
          SimpleGrid
        </Heading>
        <SimpleGrid columns={2} spacing={4} data-testid="simple-grid-example">
          <Box bg="indigo.500" color="white" p={4} borderRadius="md">
            SimpleGrid Item 1
          </Box>
          <Box bg="pink.500" color="white" p={4} borderRadius="md">
            SimpleGrid Item 2
          </Box>
          <Box bg="teal.500" color="white" p={4} borderRadius="md">
            SimpleGrid Item 3
          </Box>
          <Box bg="orange.500" color="white" p={4} borderRadius="md">
            SimpleGrid Item 4
          </Box>
        </SimpleGrid>
      </Box>

      {/* AspectRatio */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="aspect-ratio-heading">
          AspectRatio
        </Heading>
        <AspectRatio
          ratio={16 / 9}
          maxW="400px"
          data-testid="aspect-ratio-example"
        >
          <Box bg="gradient-to-r from-purple-400 to-pink-400" borderRadius="md">
            <Center h="100%">
              <Text color="white" fontSize="lg" fontWeight="bold">
                16:9 Aspect Ratio
              </Text>
            </Center>
          </Box>
        </AspectRatio>
      </Box>
    </VStack>
  );
}
