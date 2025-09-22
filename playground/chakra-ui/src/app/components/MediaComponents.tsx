import {
  Avatar,
  AvatarBadge,
  AvatarGroup,
  Icon,
  Image,
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  SimpleGrid,
  AspectRatio,
} from "@chakra-ui/react";

// Simple icon components for demonstration
function StarIcon(props: any) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
      />
    </Icon>
  );
}

function HeartIcon(props: any) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z"
      />
    </Icon>
  );
}

function SettingsIcon(props: any) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"
      />
    </Icon>
  );
}

export function MediaComponents() {
  return (
    <VStack spacing={8} align="stretch">
      {/* Avatar */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="avatar-heading">
          Avatar
        </Heading>
        <VStack spacing={6} align="stretch">
          {/* Basic Avatars */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Basic Avatars
            </Text>
            <HStack spacing={4}>
              <Avatar name="Dan Abrahmov" data-testid="avatar-name-only" />
              <Avatar
                name="Kola Tioluwani"
                src="https://bit.ly/broken-link"
                data-testid="avatar-with-fallback"
              />
              <Avatar
                src="https://images.unsplash.com/photo-1493666438817-866a91353ca9?ixlib=rb-0.3.5&q=80&fm=jpg&crop=faces&fit=crop&h=200&w=200&s=b616b2c5b373a80ffc9636ba24f7a4a9"
                data-testid="avatar-with-image"
              />
            </HStack>
          </Box>

          {/* Avatar Sizes */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Avatar Sizes
            </Text>
            <HStack spacing={4}>
              <Avatar size="xs" name="Extra Small" data-testid="avatar-xs" />
              <Avatar size="sm" name="Small" data-testid="avatar-sm" />
              <Avatar size="md" name="Medium" data-testid="avatar-md" />
              <Avatar size="lg" name="Large" data-testid="avatar-lg" />
              <Avatar size="xl" name="Extra Large" data-testid="avatar-xl" />
              <Avatar size="2xl" name="2X Large" data-testid="avatar-2xl" />
            </HStack>
          </Box>

          {/* Avatar with Badge */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Avatar with Badge
            </Text>
            <HStack spacing={4}>
              <Avatar data-testid="avatar-badge-green">
                <AvatarBadge boxSize="1.25em" bg="green.500" />
              </Avatar>
              <Avatar data-testid="avatar-badge-red">
                <AvatarBadge boxSize="1.25em" bg="red.500" />
              </Avatar>
              <Avatar data-testid="avatar-badge-yellow">
                <AvatarBadge boxSize="1.25em" bg="yellow.500" />
              </Avatar>
            </HStack>
          </Box>

          {/* Avatar Group */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Avatar Group
            </Text>
            <VStack spacing={4} align="start">
              <AvatarGroup size="md" max={3} data-testid="avatar-group-basic">
                <Avatar name="Ryan Florence" />
                <Avatar name="Segun Adebayo" />
                <Avatar name="Kent Dodds" />
                <Avatar name="Prosper Otemuyiwa" />
                <Avatar name="Christian Nwamba" />
              </AvatarGroup>

              <AvatarGroup size="sm" max={2} data-testid="avatar-group-small">
                <Avatar name="John Doe" />
                <Avatar name="Jane Smith" />
                <Avatar name="Bob Johnson" />
                <Avatar name="Alice Brown" />
              </AvatarGroup>
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* Icon */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="icon-heading">
          Icon
        </Heading>
        <VStack spacing={4} align="stretch">
          {/* Basic Icons */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Basic Icons
            </Text>
            <HStack spacing={4}>
              <StarIcon color="yellow.500" data-testid="icon-star" />
              <HeartIcon color="red.500" data-testid="icon-heart" />
              <SettingsIcon color="gray.500" data-testid="icon-settings" />
            </HStack>
          </Box>

          {/* Icon Sizes */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Icon Sizes
            </Text>
            <HStack spacing={4} align="center">
              <StarIcon boxSize={4} color="blue.500" data-testid="icon-small" />
              <StarIcon
                boxSize={6}
                color="blue.500"
                data-testid="icon-medium"
              />
              <StarIcon boxSize={8} color="blue.500" data-testid="icon-large" />
              <StarIcon boxSize={12} color="blue.500" data-testid="icon-xl" />
            </HStack>
          </Box>

          {/* Colored Icons */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Colored Icons
            </Text>
            <HStack spacing={4}>
              <HeartIcon boxSize={8} color="red.400" data-testid="icon-red" />
              <HeartIcon
                boxSize={8}
                color="green.400"
                data-testid="icon-green"
              />
              <HeartIcon boxSize={8} color="blue.400" data-testid="icon-blue" />
              <HeartIcon
                boxSize={8}
                color="purple.400"
                data-testid="icon-purple"
              />
              <HeartIcon
                boxSize={8}
                color="orange.400"
                data-testid="icon-orange"
              />
            </HStack>
          </Box>
        </VStack>
      </Box>

      {/* Image */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="image-heading">
          Image
        </Heading>
        <VStack spacing={6} align="stretch">
          {/* Basic Image */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Basic Image
            </Text>
            <Image
              boxSize="200px"
              objectFit="cover"
              src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1770&q=80"
              alt="Sample Image"
              data-testid="image-basic"
            />
          </Box>

          {/* Image with Border Radius */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Image with Border Radius
            </Text>
            <HStack spacing={4}>
              <Image
                borderRadius="md"
                boxSize="150px"
                objectFit="cover"
                src="https://images.unsplash.com/photo-1493666438817-866a91353ca9?ixlib=rb-0.3.5&q=80&fm=jpg&crop=faces&fit=crop&h=200&w=200&s=b616b2c5b373a80ffc9636ba24f7a4a9"
                alt="Rounded Image"
                data-testid="image-rounded"
              />
              <Image
                borderRadius="full"
                boxSize="150px"
                objectFit="cover"
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1469&q=80"
                alt="Circular Image"
                data-testid="image-circular"
              />
            </HStack>
          </Box>

          {/* Image with Fallback */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Image with Fallback
            </Text>
            <Image
              boxSize="200px"
              objectFit="cover"
              src="https://bit.ly/broken-link"
              fallbackSrc="https://via.placeholder.com/200"
              alt="Image with Fallback"
              data-testid="image-fallback"
            />
          </Box>

          {/* Responsive Image */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Responsive Image
            </Text>
            <AspectRatio
              maxW="400px"
              ratio={4 / 3}
              data-testid="image-responsive"
            >
              <Image
                src="https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1469&q=80"
                alt="Responsive Image"
                objectFit="cover"
              />
            </AspectRatio>
          </Box>

          {/* Image Gallery */}
          <Box>
            <Text fontWeight="semibold" mb={3}>
              Image Gallery
            </Text>
            <SimpleGrid
              columns={{ base: 2, md: 4 }}
              spacing={4}
              data-testid="image-gallery"
            >
              <Image
                src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80"
                alt="Gallery Image 1"
                borderRadius="md"
                objectFit="cover"
                h="150px"
              />
              <Image
                src="https://images.unsplash.com/photo-1493666438817-866a91353ca9?ixlib=rb-0.3.5&q=80&fm=jpg&crop=faces&fit=crop&h=300&w=300&s=b616b2c5b373a80ffc9636ba24f7a4a9"
                alt="Gallery Image 2"
                borderRadius="md"
                objectFit="cover"
                h="150px"
              />
              <Image
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80"
                alt="Gallery Image 3"
                borderRadius="md"
                objectFit="cover"
                h="150px"
              />
              <Image
                src="https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&q=80"
                alt="Gallery Image 4"
                borderRadius="md"
                objectFit="cover"
                h="150px"
              />
            </SimpleGrid>
          </Box>
        </VStack>
      </Box>
    </VStack>
  );
}
