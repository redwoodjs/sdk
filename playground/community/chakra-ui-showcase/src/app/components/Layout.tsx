import React from "react"
import {
  Flex,
  Text,
  Stack,
} from "@chakra-ui/react";

export const Section = ({ children }: { children: React.ReactNode }) => {
  return (
    <Flex direction="column" gap="5" mb={{ base: "5", sm: "8" }}>
      {children}
    </Flex>
  );
};

interface SectionTitleProps {
  children: React.ReactNode;
  id: string;
}

export const SectionTitle = ({ children, id }: SectionTitleProps) => {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="4"
      mt="2"
      bg="bg.muted"
      px="4"
      py="3"
      rounded="md"
      colorPalette="gray"
      textStyle="sm"
    >
      <Text fontWeight="medium" id={id}>
        {children}
      </Text>
    </Flex>
  );
};

export const SectionContent = (props: any) => {
  return <Stack gap="8" {...props} />;
};

interface DemoListProps {
  items: Array<{
    label: string;
    component: JSX.Element;
  }>;
}

export const DemoList = (props: DemoListProps) => {
  const { items } = props;
  return (
    <>
      {items.map(({ label, component }) => (
        <Stack key={label} align="flex-start" gap="5">
          <Text color="fg.muted" textStyle="sm" fontWeight="medium">
            {label}
          </Text>
          {component}
        </Stack>
      ))}
    </>
  );
};
