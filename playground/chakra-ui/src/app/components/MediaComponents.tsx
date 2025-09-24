import {
  AspectRatio,
  Avatar,
  AvatarGroup,
  Box,
  Image,
  VStack,
} from "@chakra-ui/react";

export function MediaComponents() {
  return (
    <VStack gap={8} alignItems="flex-start">
      <Avatar
        name="Chakra UI"
        src="https://avatars.githubusercontent.com/u/54212428?s=200&v=4"
      />
      <AvatarGroup>
        <Avatar
          name="Dan Abrahmov"
          src="https://bit.ly/dan-abramov"
          data-testid="avatar-name-only"
        />
        <Avatar name="Ryan Florence" src="https://bit.ly/ryan-florence" />
      </AvatarGroup>

      <AspectRatio ratio={16 / 9} w="400px">
        <Image
          src="https://bit.ly/naruto-sage"
          alt="Naruto"
          objectFit="cover"
        />
      </AspectRatio>
    </VStack>
  );
}
