import { HStack, Kbd, Text } from "@chakra-ui/react";
import { DemoList } from "./Layout";

export const KbdDemo = () => {
  return (
    <DemoList
      items={[
        {
          label: "Shortcuts",
          component: (
            <HStack wrap="wrap" gap="4">
              <HStack>
                <Kbd>⌘</Kbd>
                <Text>+</Text>
                <Kbd>C</Kbd>
              </HStack>
              <HStack>
                <Kbd>Ctrl</Kbd>
                <Text>+</Text>
                <Kbd>V</Kbd>
              </HStack>
              <HStack>
                <Kbd>Shift</Kbd>
                <Text>+</Text>
                <Kbd>Enter</Kbd>
              </HStack>
            </HStack>
          ),
        },
        {
          label: "Sizes",
          component: (
            <HStack gap="4">
              <Kbd size="sm">⌘ K</Kbd>
              <Kbd size="md">⌘ K</Kbd>
              <Kbd size="lg">⌘ K</Kbd>
            </HStack>
          ),
        },
      ]}
    />
  );
};
