import {
  Avatar,
  AvatarGroup,
  Badge,
  Box,
  Card,
  CardBody,
  CardHeader,
  Divider,
  HStack,
  List,
  ListItem,
  Stat,
  Table,
  Tag,
  Text,
  VStack,
} from "@chakra-ui/react";

export function DataDisplayComponents() {
  return (
    <VStack gap={8} alignItems="flex-start">
      <Card>
        <CardHeader>
          <Text fontSize="xl">Card Component</Text>
        </CardHeader>
        <CardBody>
          <Text>This is the body of the card.</Text>
        </CardBody>
      </Card>

      <HStack gap={4}>
        <Avatar
          name="Dan Abrahmov"
          src="https://bit.ly/dan-abramov"
          data-testid="avatar-name-only"
        />
        <AvatarGroup>
          <Avatar name="Ryan Florence" src="https://bit.ly/ryan-florence" />
          <Avatar name="Segun Adebayo" src="https://bit.ly/sage-adebayo" />
        </AvatarGroup>
      </HStack>

      <Stat.Root>
        <Stat.Label>Collected</Stat.Label>
        <Stat.Number>$3,450</Stat.Number>
        <Stat.HelpText>
          <Stat.Arrow type="increase" />
          23.36%
        </Stat.HelpText>
      </Stat.Root>

      <List>
        <ListItem>List Item 1</ListItem>
        <ListItem>List Item 2</ListItem>
      </List>
      <Divider />
      <Table.Root variant="simple">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>John Doe</Table.Td>
            <Table.Td>john.doe@example.com</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table.Root>
      <HStack>
        <Tag>Sample Tag</Tag>
        <Tag colorScheme="teal">Teal Tag</Tag>
      </HStack>
    </VStack>
  );
}
