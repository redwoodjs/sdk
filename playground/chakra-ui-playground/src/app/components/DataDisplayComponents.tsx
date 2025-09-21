import {
  Badge,
  Card,
  Code,
  Separator,
  Kbd,
  List,
  ListItem,
  Stat,
  StatLabel,
  StatValueText,
  StatHelpText,
  StatUpIndicator,
  StatDownIndicator,
  StatGroup,
  Table,
  Tag,
  Text,
  Box,
  VStack,
  HStack,
  Heading,
  Avatar,
  AvatarGroup,
  Icon,
  Image,
  SimpleGrid,
} from "@chakra-ui/react";

export function DataDisplayComponents() {
  return (
    <VStack spacing={8} align="stretch">
      {/* Badge */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="badge-heading">
          Badge
        </Heading>
        <HStack spacing={4}>
          <Badge data-testid="badge-default">Default</Badge>
          <Badge colorScheme="green" data-testid="badge-green">
            Success
          </Badge>
          <Badge colorScheme="red" data-testid="badge-red">
            Error
          </Badge>
          <Badge colorScheme="purple" data-testid="badge-purple">
            New
          </Badge>
          <Badge
            variant="outline"
            colorScheme="blue"
            data-testid="badge-outline"
          >
            Outline
          </Badge>
          <Badge
            variant="subtle"
            colorScheme="orange"
            data-testid="badge-subtle"
          >
            Subtle
          </Badge>
        </HStack>
      </Box>

      {/* Card */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="card-heading">
          Card
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Card.Root data-testid="card-basic">
            <Card.Header>
              <Heading size="md">Basic Card</Heading>
            </Card.Header>
            <Card.Body>
              <Text>This is a basic card with header and body content.</Text>
            </Card.Body>
          </Card.Root>

          <Card.Root data-testid="card-with-footer">
            <Card.Header>
              <Heading size="md">Card with Footer</Heading>
            </Card.Header>
            <Card.Body>
              <Text>This card includes a footer section.</Text>
            </Card.Body>
            <Card.Footer>
              <Text fontSize="sm" color="gray.500">
                Footer content
              </Text>
            </Card.Footer>
          </Card.Root>
        </SimpleGrid>
      </Box>

      {/* Code */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="code-heading">
          Code
        </Heading>
        <VStack spacing={2} align="stretch">
          <Text>
            Inline code:{" "}
            <Code data-testid="code-inline">console.log('Hello World')</Code>
          </Text>
          <Code
            display="block"
            whiteSpace="pre"
            p={4}
            borderRadius="md"
            data-testid="code-block"
          >
            {`function greet(name) {
  return \`Hello, \${name}!\`;
}`}
          </Code>
        </VStack>
      </Box>

      {/* Kbd */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="kbd-heading">
          Kbd (Keyboard Key)
        </Heading>
        <Text data-testid="kbd-example">
          Press <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> to copy, or <Kbd>Cmd</Kbd> +{" "}
          <Kbd>V</Kbd> to paste.
        </Text>
      </Box>

      {/* List */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="list-heading">
          List
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Box>
            <Text fontWeight="semibold" mb={2}>
              Unordered List
            </Text>
            <List.Root data-testid="unordered-list">
              <ListItem>First item</ListItem>
              <ListItem>Second item</ListItem>
              <ListItem>Third item</ListItem>
            </List.Root>
          </Box>

          <Box>
            <Text fontWeight="semibold" mb={2}>
              Ordered List
            </Text>
            <List.Root as="ol" data-testid="ordered-list">
              <ListItem>First step</ListItem>
              <ListItem>Second step</ListItem>
              <ListItem>Third step</ListItem>
            </List.Root>
          </Box>
        </SimpleGrid>
      </Box>

      {/* Stat */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="stat-heading">
          Stat
        </Heading>
        <StatGroup data-testid="stat-group">
          <Stat.Root data-testid="stat-sent">
            <StatLabel>Sent</StatLabel>
            <StatValueText>345,670</StatValueText>
            <StatHelpText>
              <StatUpIndicator />
              23.36%
            </StatHelpText>
          </Stat.Root>

          <Stat.Root data-testid="stat-clicked">
            <StatLabel>Clicked</StatLabel>
            <StatValueText>45</StatValueText>
            <StatHelpText>
              <StatDownIndicator />
              9.05%
            </StatHelpText>
          </Stat.Root>
        </StatGroup>
      </Box>

      {/* Table */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="table-heading">
          Table
        </Heading>
        <Table.ScrollArea data-testid="table-container">
          <Table.Root variant="simple">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Email</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Age</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row data-testid="table-row-1">
                <Table.Cell>John Doe</Table.Cell>
                <Table.Cell>john@example.com</Table.Cell>
                <Table.Cell textAlign="end">30</Table.Cell>
              </Table.Row>
              <Table.Row data-testid="table-row-2">
                <Table.Cell>Jane Smith</Table.Cell>
                <Table.Cell>jane@example.com</Table.Cell>
                <Table.Cell textAlign="end">25</Table.Cell>
              </Table.Row>
              <Table.Row data-testid="table-row-3">
                <Table.Cell>Bob Johnson</Table.Cell>
                <Table.Cell>bob@example.com</Table.Cell>
                <Table.Cell textAlign="end">35</Table.Cell>
              </Table.Row>
            </Table.Body>
            <Table.Caption>Sample data table</Table.Caption>
          </Table.Root>
        </Table.ScrollArea>
      </Box>

      {/* Tag */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="tag-heading">
          Tag
        </Heading>
        <HStack spacing={4} wrap="wrap">
          <Tag.Root data-testid="tag-default">
            <Tag.Label>Default</Tag.Label>
          </Tag.Root>
          <Tag.Root size="sm" colorPalette="blue" data-testid="tag-small">
            <Tag.Label>Small</Tag.Label>
          </Tag.Root>
          <Tag.Root size="lg" colorPalette="green" data-testid="tag-large">
            <Tag.Label>Large</Tag.Label>
          </Tag.Root>
          <Tag.Root colorPalette="red" data-testid="tag-closable">
            <Tag.Label>Closable</Tag.Label>
            <Tag.CloseTrigger />
          </Tag.Root>
        </HStack>
      </Box>

      {/* Avatar */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="avatar-heading">
          Avatar
        </Heading>
        <VStack spacing={4}>
          <HStack spacing={4}>
            <Avatar.Root name="John Doe" data-testid="avatar-initials">
              <Avatar.Fallback>JD</Avatar.Fallback>
            </Avatar.Root>
            <Avatar.Root name="Jane Smith" data-testid="avatar-fallback">
              <Avatar.Image src="https://bit.ly/broken-link" />
              <Avatar.Fallback>JS</Avatar.Fallback>
            </Avatar.Root>
            <Avatar.Root
              size="sm"
              name="Small Avatar"
              data-testid="avatar-small"
            >
              <Avatar.Fallback>SA</Avatar.Fallback>
            </Avatar.Root>
            <Avatar.Root
              size="lg"
              name="Large Avatar"
              data-testid="avatar-large"
            >
              <Avatar.Fallback>LA</Avatar.Fallback>
            </Avatar.Root>
          </HStack>

          <Box>
            <Text fontWeight="semibold" mb={2}>
              Avatar with Badge
            </Text>
            <Avatar.Root data-testid="avatar-with-badge">
              <Avatar.Image />
              <Avatar.Fallback>AB</Avatar.Fallback>
            </Avatar.Root>
          </Box>

          <Box>
            <Text fontWeight="semibold" mb={2}>
              Avatar Group
            </Text>
            <AvatarGroup size="md" max={3} data-testid="avatar-group">
              <Avatar.Root name="Ryan Florence">
                <Avatar.Fallback>RF</Avatar.Fallback>
              </Avatar.Root>
              <Avatar.Root name="Segun Adebayo">
                <Avatar.Fallback>SA</Avatar.Fallback>
              </Avatar.Root>
              <Avatar.Root name="Kent Dodds">
                <Avatar.Fallback>KD</Avatar.Fallback>
              </Avatar.Root>
              <Avatar.Root name="Prosper Otemuyiwa">
                <Avatar.Fallback>PO</Avatar.Fallback>
              </Avatar.Root>
              <Avatar.Root name="Christian Nwamba">
                <Avatar.Fallback>CN</Avatar.Fallback>
              </Avatar.Root>
            </AvatarGroup>
          </Box>
        </VStack>
      </Box>

      {/* Separator */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="separator-heading">
          Separator
        </Heading>
        <VStack spacing={4}>
          <Box w="100%">
            <Text>Content above</Text>
            <Separator my={4} data-testid="separator-horizontal" />
            <Text>Content below</Text>
          </Box>

          <HStack h="50px" spacing={4}>
            <Text>Left content</Text>
            <Separator
              orientation="vertical"
              data-testid="separator-vertical"
            />
            <Text>Right content</Text>
          </HStack>
        </VStack>
      </Box>
    </VStack>
  );
}
