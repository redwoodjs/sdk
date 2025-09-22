"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  Link,
  LinkBox,
  LinkOverlay,
  Stepper,
  Step,
  StepIndicator,
  StepStatus,
  StepIcon,
  StepNumber,
  StepTitle,
  StepDescription,
  StepSeparator,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  useSteps,
} from "@chakra-ui/react";

const steps = [
  { title: "First", description: "Contact Info" },
  { title: "Second", description: "Date & Time" },
  { title: "Third", description: "Select Rooms" },
];

export function NavigationComponents() {
  const { activeStep } = useSteps({
    index: 1,
    count: steps.length,
  });

  return (
    <VStack spacing={8} align="stretch">
      {/* Breadcrumb */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="breadcrumb-heading">
          Breadcrumb
        </Heading>
        <Breadcrumb data-testid="breadcrumb-example">
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Home</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem>
            <BreadcrumbLink href="#">Docs</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink href="#">Breadcrumb</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>
      </Box>

      {/* Link */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="link-heading">
          Link
        </Heading>
        <VStack spacing={4} align="stretch">
          <Text>
            This is a paragraph with a{" "}
            <Link color="blue.500" href="#" data-testid="link-inline">
              basic link
            </Link>{" "}
            in the middle.
          </Text>

          <Text>
            External link:{" "}
            <Link
              color="blue.500"
              href="#"
              isExternal
              data-testid="link-external"
            >
              Chakra UI (opens in new tab)
            </Link>
          </Text>

          <LinkBox
            as="article"
            maxW="sm"
            p="5"
            borderWidth="1px"
            rounded="md"
            data-testid="link-box"
          >
            <Text fontSize="sm" color="gray.500">
              13th October, 2021
            </Text>
            <LinkOverlay href="#">
              <Heading size="md" my="2">
                New Chakra UI Version
              </Heading>
            </LinkOverlay>
            <Text>
              Incremental adoption and migration strategies. This is the
              description of the article.
            </Text>
          </LinkBox>
        </VStack>
      </Box>

      {/* Stepper */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="stepper-heading">
          Stepper
        </Heading>
        <Stepper index={activeStep} data-testid="stepper-example">
          {steps.map((step, index) => (
            <Step key={index}>
              <StepIndicator>
                <StepStatus
                  complete={<StepIcon />}
                  incomplete={<StepNumber />}
                  active={<StepNumber />}
                />
              </StepIndicator>

              <Box flexShrink="0">
                <StepTitle>{step.title}</StepTitle>
                <StepDescription>{step.description}</StepDescription>
              </Box>

              <StepSeparator />
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Tabs */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="tabs-heading">
          Tabs
        </Heading>
        <VStack spacing={6} align="stretch">
          {/* Basic Tabs */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Basic Tabs
            </Text>
            <Tabs data-testid="tabs-basic">
              <TabList>
                <Tab>One</Tab>
                <Tab>Two</Tab>
                <Tab>Three</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <Text>
                    Panel One - This is the content for the first tab.
                  </Text>
                </TabPanel>
                <TabPanel>
                  <Text>
                    Panel Two - This is the content for the second tab.
                  </Text>
                </TabPanel>
                <TabPanel>
                  <Text>
                    Panel Three - This is the content for the third tab.
                  </Text>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>

          {/* Colored Tabs */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Colored Tabs
            </Text>
            <Tabs
              variant="enclosed"
              colorScheme="green"
              data-testid="tabs-colored"
            >
              <TabList>
                <Tab>Settings</Tab>
                <Tab>Billing</Tab>
                <Tab>Preferences</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <Text>Settings panel content goes here.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>Billing information and payment details.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>User preferences and customization options.</Text>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>

          {/* Vertical Tabs */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Vertical Tabs
            </Text>
            <Tabs
              orientation="vertical"
              variant="line"
              data-testid="tabs-vertical"
            >
              <TabList>
                <Tab>Profile</Tab>
                <Tab>Security</Tab>
                <Tab>Notifications</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <Text>Profile settings and personal information.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>Security settings, passwords, and authentication.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>Notification preferences and email settings.</Text>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>

          {/* Soft-rounded Tabs */}
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Soft-rounded Tabs
            </Text>
            <Tabs
              variant="soft-rounded"
              colorScheme="blue"
              data-testid="tabs-soft-rounded"
            >
              <TabList>
                <Tab>Dashboard</Tab>
                <Tab>Analytics</Tab>
                <Tab>Reports</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <Text>Dashboard overview with key metrics.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>Detailed analytics and data visualization.</Text>
                </TabPanel>
                <TabPanel>
                  <Text>Generated reports and export options.</Text>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </VStack>
      </Box>
    </VStack>
  );
}
