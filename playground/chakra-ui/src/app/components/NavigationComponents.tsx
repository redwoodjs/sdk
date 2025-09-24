"use client";

import {
  Breadcrumb,
  Button,
  HStack,
  Link,
  Tabs,
  VStack,
  useSteps,
} from "@chakra-ui/react";

export function NavigationComponents() {
  const steps = [{ title: "First" }, { title: "Second" }, { title: "Third" }];
  const { activeStep, goToNext, goToPrevious } = useSteps({
    index: 1,
    count: steps.length,
  });

  return (
    <VStack gap={8} alignItems="flex-start">
      <Breadcrumb.Root data-testid="breadcrumb-example">
        <Breadcrumb.Item>
          <Breadcrumb.Link href="#">Home</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item isCurrentPage>
          <Breadcrumb.Link href="#">Components</Breadcrumb.Link>
        </Breadcrumb.Item>
      </Breadcrumb.Root>

      <Link href="https://chakra-ui.com" isExternal>
        Chakra UI Website
      </Link>

      <Tabs.Root data-testid="tabs-basic">
        <Tabs.List>
          <Tabs.Trigger>One</Tabs.Trigger>
          <Tabs.Trigger>Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">
          <p>Panel One</p>
        </Tabs.Content>
        <Tabs.Content value="two">
          <p>Panel Two</p>
        </Tabs.Content>
      </Tabs.Root>
    </VStack>
  );
}
