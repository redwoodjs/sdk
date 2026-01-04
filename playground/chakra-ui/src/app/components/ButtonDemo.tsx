import { HStack, Button } from "@chakra-ui/react";
import { DemoList } from "./Layout";

export const ButtonDemo = () => {
  const buttonVariants = ["solid", "outline", "ghost", "subtle"] as const;

  return (
    <DemoList
      items={[
        {
          label: "Accent Colors",
          component: (
            <HStack wrap="wrap">
              {buttonVariants.map((variant) => (
                <Button key={variant} variant={variant}>
                  Click me
                </Button>
              ))}
            </HStack>
          ),
        },
        {
          label: "Color Schemes",
          component: (
            <HStack wrap="wrap">
              <Button colorScheme="blue" data-testid="button-solid">
                Blue
              </Button>
              <Button colorScheme="teal">Teal</Button>
              <Button colorScheme="pink">Pink</Button>
              <Button colorScheme="purple">Purple</Button>
            </HStack>
          ),
        },
      ]}
    />
  );
};
