import { HStack, VStack, Code } from "@chakra-ui/react";
import { DemoList } from "./Layout";

export const CodeDemo = () => {
  const codeVariants = ["subtle", "surface", "outline", "solid"] as const;

  return (
    <DemoList
      items={[
        {
          label: "Variants",
          component: (
            <HStack wrap="wrap" gap="4">
              {codeVariants.map((variant) => (
                <Code key={variant} variant={variant} size="md">
                  console.log()
                </Code>
              ))}
            </HStack>
          ),
        },
        {
          label: "Examples",
          component: (
            <VStack align="flex-start" gap="3">
              <Code>const greeting = "Hello, World!"</Code>
              <Code>function sum(a, b) {"{ return a + b }"}</Code>
              <Code colorScheme="red">Error: undefined</Code>
            </VStack>
          ),
        },
      ]}
    />
  );
};
