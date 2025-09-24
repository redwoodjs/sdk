"use client";

import {
  Alert,
  Button,
  CircularProgress,
  CircularProgressLabel,
  HStack,
  Progress,
  Skeleton,
  SkeletonText,
  Spinner,
  useToast,
  VStack,
} from "@chakra-ui/react";

export function FeedbackComponents() {
  const toast = useToast();

  return (
    <VStack gap={8} alignItems="flex-start">
      <Alert.Root status="success" data-testid="alert-success">
        <Alert.Icon />
        <Alert.Title>Success!</Alert.Title>
        <Alert.Description>Your action was successful.</Alert.Description>
      </Alert.Root>

      <HStack gap={4}>
        <CircularProgress value={40} color="green.400">
          <CircularProgressLabel>40%</CircularProgressLabel>
        </CircularProgress>
        <Progress value={80} />
        <Spinner />
      </HStack>

      <VStack gap={2} w="full">
        <Skeleton height="20px" w="full" />
        <SkeletonText noOfLines={2} gap="4" w="full" />
      </VStack>

      <Button
        data-testid="toast-success-button"
        onClick={() =>
          toast({
            title: "Success",
            description: "This is a success toast.",
            status: "success",
            duration: 3000,
            isClosable: true,
          })
        }
      >
        Show Success Toast
      </Button>
    </VStack>
  );
}
