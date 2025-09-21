"use client";

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CircularProgress,
  CircularProgressLabel,
  Progress,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Spinner,
  Toast,
  useToast,
  Box,
  VStack,
  HStack,
  Heading,
  Button,
  Text,
  SimpleGrid,
} from "@chakra-ui/react";

export function FeedbackComponents() {
  const toast = useToast();

  const showToast = (status: "success" | "error" | "warning" | "info") => {
    toast({
      title: `${status.charAt(0).toUpperCase() + status.slice(1)} Toast`,
      description: `This is a ${status} toast message.`,
      status,
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <VStack spacing={8} align="stretch">
      {/* Alert */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="alert-heading">
          Alert
        </Heading>
        <VStack spacing={4} align="stretch">
          <Alert status="success" data-testid="alert-success">
            <AlertIcon />
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
              Your operation completed successfully.
            </AlertDescription>
          </Alert>

          <Alert status="error" data-testid="alert-error">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>

          <Alert status="warning" data-testid="alert-warning">
            <AlertIcon />
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Please review your input before proceeding.
            </AlertDescription>
          </Alert>

          <Alert status="info" data-testid="alert-info">
            <AlertIcon />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              Here's some helpful information for you.
            </AlertDescription>
          </Alert>
        </VStack>
      </Box>

      {/* Progress */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="progress-heading">
          Progress
        </Heading>
        <VStack spacing={4} align="stretch">
          <Box>
            <Text mb={2}>Basic Progress</Text>
            <Progress value={32} data-testid="progress-basic" />
          </Box>

          <Box>
            <Text mb={2}>Colored Progress</Text>
            <Progress
              value={64}
              colorScheme="green"
              data-testid="progress-colored"
            />
          </Box>

          <Box>
            <Text mb={2}>Striped Progress</Text>
            <Progress
              value={80}
              colorScheme="pink"
              hasStripe
              data-testid="progress-striped"
            />
          </Box>

          <Box>
            <Text mb={2}>Animated Progress</Text>
            <Progress
              value={45}
              colorScheme="blue"
              hasStripe
              isAnimated
              data-testid="progress-animated"
            />
          </Box>
        </VStack>
      </Box>

      {/* CircularProgress */}
      <Box>
        <Heading
          as="h3"
          size="md"
          mb={4}
          data-testid="circular-progress-heading"
        >
          CircularProgress
        </Heading>
        <HStack spacing={8}>
          <Box textAlign="center">
            <CircularProgress
              value={40}
              data-testid="circular-progress-basic"
            />
            <Text mt={2}>Basic</Text>
          </Box>

          <Box textAlign="center">
            <CircularProgress
              value={60}
              color="green.400"
              data-testid="circular-progress-colored"
            >
              <CircularProgressLabel>60%</CircularProgressLabel>
            </CircularProgress>
            <Text mt={2}>With Label</Text>
          </Box>

          <Box textAlign="center">
            <CircularProgress
              isIndeterminate
              color="blue.300"
              data-testid="circular-progress-indeterminate"
            />
            <Text mt={2}>Indeterminate</Text>
          </Box>

          <Box textAlign="center">
            <CircularProgress
              value={75}
              size="120px"
              color="purple.400"
              data-testid="circular-progress-large"
            >
              <CircularProgressLabel>75%</CircularProgressLabel>
            </CircularProgress>
            <Text mt={2}>Large</Text>
          </Box>
        </HStack>
      </Box>

      {/* Spinner */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="spinner-heading">
          Spinner
        </Heading>
        <HStack spacing={8}>
          <Box textAlign="center">
            <Spinner data-testid="spinner-default" />
            <Text mt={2}>Default</Text>
          </Box>

          <Box textAlign="center">
            <Spinner color="red.500" data-testid="spinner-colored" />
            <Text mt={2}>Colored</Text>
          </Box>

          <Box textAlign="center">
            <Spinner size="xl" data-testid="spinner-large" />
            <Text mt={2}>Large</Text>
          </Box>

          <Box textAlign="center">
            <Spinner
              thickness="4px"
              speed="0.65s"
              emptyColor="gray.200"
              color="blue.500"
              size="xl"
              data-testid="spinner-custom"
            />
            <Text mt={2}>Custom</Text>
          </Box>
        </HStack>
      </Box>

      {/* Skeleton */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="skeleton-heading">
          Skeleton
        </Heading>
        <VStack spacing={4} align="stretch">
          <Box>
            <Text mb={2}>Basic Skeleton</Text>
            <Skeleton height="20px" data-testid="skeleton-basic" />
          </Box>

          <Box>
            <Text mb={2}>Skeleton Text</Text>
            <SkeletonText
              mt="4"
              noOfLines={4}
              spacing="4"
              skeletonHeight="2"
              data-testid="skeleton-text"
            />
          </Box>

          <Box>
            <Text mb={2}>Skeleton with Circle</Text>
            <HStack>
              <SkeletonCircle size="10" data-testid="skeleton-circle" />
              <VStack align="stretch" flex="1">
                <Skeleton height="20px" />
                <Skeleton height="20px" />
                <Skeleton height="20px" />
              </VStack>
            </HStack>
          </Box>

          <Box>
            <Text mb={2}>Loaded Skeleton</Text>
            <Skeleton isLoaded data-testid="skeleton-loaded">
              <Text>This content is now loaded and visible!</Text>
            </Skeleton>
          </Box>
        </VStack>
      </Box>

      {/* Toast */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="toast-heading">
          Toast
        </Heading>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
          <Button
            onClick={() => showToast("success")}
            colorScheme="green"
            data-testid="toast-success-button"
          >
            Success Toast
          </Button>

          <Button
            onClick={() => showToast("error")}
            colorScheme="red"
            data-testid="toast-error-button"
          >
            Error Toast
          </Button>

          <Button
            onClick={() => showToast("warning")}
            colorScheme="orange"
            data-testid="toast-warning-button"
          >
            Warning Toast
          </Button>

          <Button
            onClick={() => showToast("info")}
            colorScheme="blue"
            data-testid="toast-info-button"
          >
            Info Toast
          </Button>
        </SimpleGrid>
      </Box>
    </VStack>
  );
}
