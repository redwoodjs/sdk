import { HStack, Badge } from "@chakra-ui/react";
import { DemoList } from "./Layout";

export const BadgeDemo = () => {
  const badgeVariants = ["solid", "outline", "subtle"] as const;

  return (
    <DemoList
      items={[
        {
          label: "Variants",
          component: (
            <HStack wrap="wrap" gap="4">
              {badgeVariants.map((variant) => (
                <Badge
                  key={variant}
                  variant={variant}
                  colorScheme="green"
                >
                  {variant}
                </Badge>
              ))}
            </HStack>
          ),
        },
        {
          label: "Color Schemes",
          component: (
            <HStack wrap="wrap" gap="4">
              <Badge colorScheme="green" data-testid="badge-default">
                Success
              </Badge>
              <Badge colorScheme="red" variant="solid">
                Error
              </Badge>
              <Badge colorScheme="purple" variant="outline">
                Info
              </Badge>
              <Badge colorScheme="orange" variant="subtle">
                Warning
              </Badge>
            </HStack>
          ),
        },
      ]}
    />
  );
};
