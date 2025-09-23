"use client";

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogCloseButton,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuItemOption,
  MenuGroup,
  MenuOptionGroup,
  MenuDivider,
  useDisclosure,
  Button,
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  FormControl,
  FormLabel,
  SimpleGrid,
} from "@chakra-ui/react";
import { useRef } from "react";

export function OverlayComponents() {
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure();
  const {
    isOpen: isAlertOpen,
    onOpen: onAlertOpen,
    onClose: onAlertClose,
  } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <VStack spacing={8} align="stretch">
      {/* Modal */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="modal-heading">
          Modal
        </Heading>
        <Button onClick={onModalOpen} data-testid="modal-trigger">
          Open Modal
        </Button>

        <Modal
          isOpen={isModalOpen}
          onClose={onModalClose}
          data-testid="modal-example"
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Modal Title</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text>
                This is a modal dialog. You can put any content here, including
                forms, images, or other components.
              </Text>
              <FormControl mt={4}>
                <FormLabel>Email</FormLabel>
                <Input placeholder="Enter your email" />
              </FormControl>
            </ModalBody>

            <ModalFooter>
              <Button colorScheme="blue" mr={3}>
                Save
              </Button>
              <Button variant="ghost" onClick={onModalClose}>
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>

      {/* Drawer */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="drawer-heading">
          Drawer
        </Heading>
        <Button onClick={onDrawerOpen} data-testid="drawer-trigger">
          Open Drawer
        </Button>

        <Drawer
          isOpen={isDrawerOpen}
          placement="right"
          onClose={onDrawerClose}
          data-testid="drawer-example"
        >
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>Create your account</DrawerHeader>

            <DrawerBody>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Name</FormLabel>
                  <Input placeholder="Type here..." />
                </FormControl>
                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input type="email" placeholder="Type here..." />
                </FormControl>
                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input type="tel" placeholder="Type here..." />
                </FormControl>
              </VStack>
            </DrawerBody>

            <DrawerFooter>
              <Button variant="outline" mr={3} onClick={onDrawerClose}>
                Cancel
              </Button>
              <Button colorScheme="blue">Submit</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </Box>

      {/* AlertDialog */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="alert-dialog-heading">
          AlertDialog
        </Heading>
        <Button
          colorScheme="red"
          onClick={onAlertOpen}
          data-testid="alert-dialog-trigger"
        >
          Delete Something
        </Button>

        <AlertDialog
          isOpen={isAlertOpen}
          leastDestructiveRef={cancelRef}
          onClose={onAlertClose}
          data-testid="alert-dialog-example"
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Customer
              </AlertDialogHeader>

              <AlertDialogBody>
                Are you sure? You can't undo this action afterwards.
              </AlertDialogBody>

              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onAlertClose}>
                  Cancel
                </Button>
                <Button colorScheme="red" onClick={onAlertClose} ml={3}>
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Box>

      {/* Popover */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="popover-heading">
          Popover
        </Heading>
        <HStack spacing={4}>
          <Popover data-testid="popover-basic">
            <PopoverTrigger>
              <Button>Basic Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverHeader>Confirmation!</PopoverHeader>
              <PopoverBody>
                Are you sure you want to have that milkshake?
              </PopoverBody>
            </PopoverContent>
          </Popover>

          <Popover data-testid="popover-with-footer">
            <PopoverTrigger>
              <Button>Popover with Footer</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverArrow />
              <PopoverCloseButton />
              <PopoverHeader>Header</PopoverHeader>
              <PopoverBody>
                <Text>This popover has a footer with action buttons.</Text>
              </PopoverBody>
              <PopoverFooter>
                <HStack spacing={2} justify="flex-end">
                  <Button size="sm" variant="outline">
                    Cancel
                  </Button>
                  <Button size="sm" colorScheme="blue">
                    Apply
                  </Button>
                </HStack>
              </PopoverFooter>
            </PopoverContent>
          </Popover>
        </HStack>
      </Box>

      {/* Tooltip */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="tooltip-heading">
          Tooltip
        </Heading>
        <HStack spacing={4} wrap="wrap">
          <Tooltip label="Hey, I'm here!" data-testid="tooltip-basic">
            <Button>Hover me</Button>
          </Tooltip>

          <Tooltip
            label="This tooltip has an arrow"
            hasArrow
            data-testid="tooltip-with-arrow"
          >
            <Button>With Arrow</Button>
          </Tooltip>

          <Tooltip
            label="This tooltip opens on click"
            placement="top"
            data-testid="tooltip-placement"
          >
            <Button>Top Placement</Button>
          </Tooltip>

          <Tooltip
            label="Colored tooltip"
            bg="red.600"
            color="white"
            data-testid="tooltip-colored"
          >
            <Button>Colored Tooltip</Button>
          </Tooltip>
        </HStack>
      </Box>

      {/* Menu */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="menu-heading">
          Menu
        </Heading>
        <HStack spacing={4}>
          <Menu data-testid="menu-basic">
            <MenuButton as={Button}>Basic Menu</MenuButton>
            <MenuList>
              <MenuItem>Download</MenuItem>
              <MenuItem>Create a Copy</MenuItem>
              <MenuItem>Mark as Draft</MenuItem>
              <MenuItem>Delete</MenuItem>
            </MenuList>
          </Menu>

          <Menu data-testid="menu-with-groups">
            <MenuButton as={Button}>Menu with Groups</MenuButton>
            <MenuList>
              <MenuGroup title="Profile">
                <MenuItem>My Account</MenuItem>
                <MenuItem>Payments</MenuItem>
              </MenuGroup>
              <MenuDivider />
              <MenuGroup title="Help">
                <MenuItem>Docs</MenuItem>
                <MenuItem>FAQ</MenuItem>
              </MenuGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false} data-testid="menu-with-options">
            <MenuButton as={Button}>Menu with Options</MenuButton>
            <MenuList minWidth="240px">
              <MenuOptionGroup defaultValue="asc" title="Order" type="radio">
                <MenuItemOption value="asc">Ascending</MenuItemOption>
                <MenuItemOption value="desc">Descending</MenuItemOption>
              </MenuOptionGroup>
              <MenuDivider />
              <MenuOptionGroup title="Country" type="checkbox">
                <MenuItemOption value="email">Email</MenuItemOption>
                <MenuItemOption value="phone">Phone</MenuItemOption>
                <MenuItemOption value="country">Country</MenuItemOption>
              </MenuOptionGroup>
            </MenuList>
          </Menu>
        </HStack>
      </Box>
    </VStack>
  );
}
