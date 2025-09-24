"use client";

import {
  AlertDialog,
  Button,
  Drawer,
  HStack,
  Menu,
  Modal,
  Popover,
  Tooltip,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import React from "react";

export function OverlayComponents() {
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const {
    isOpen: isAlertOpen,
    onOpen: onAlertOpen,
    onClose: onAlertClose,
  } = useDisclosure();
  const {
    isOpen: isDrawerOpen,
    onOpen: onDrawerOpen,
    onClose: onDrawerClose,
  } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <VStack gap={8} alignItems="flex-start">
      <HStack gap={4}>
        <Button onClick={onModalOpen} data-testid="modal-trigger">
          Open Modal
        </Button>
        <Button onClick={onAlertOpen}>Open Alert Dialog</Button>
        <Button onClick={onDrawerOpen}>Open Drawer</Button>
      </HStack>

      <HStack gap={8}>
        <Popover.Root>
          <Popover.Trigger>
            <Button>Popover</Button>
          </Popover.Trigger>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.CloseTrigger />
            <Popover.Header>Confirmation!</Popover.Header>
            <Popover.Body>Are you sure you want to have that?</Popover.Body>
          </Popover.Content>
        </Popover.Root>

        <Tooltip.Root label="This is a tooltip">
          <Tooltip.Trigger>
            <Button>Tooltip</Button>
          </Tooltip.Trigger>
        </Tooltip.Root>

        <Menu.Root>
          <Menu.Trigger asChild>
            <Button>Menu</Button>
          </Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Download</Menu.Item>
            <Menu.Item>Create a Copy</Menu.Item>
          </Menu.Content>
        </Menu.Root>
      </HStack>

      {/* Modal */}
      <Modal.Root isOpen={isModalOpen} onClose={onModalClose}>
        <Modal.Backdrop />
        <Modal.Positioner>
          <Modal.Content data-testid="modal-example">
            <Modal.Header>Modal Title</Modal.Header>
            <Modal.CloseTrigger />
            <Modal.Body>
              <p>This is the modal body.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button colorScheme="blue" mr={3} onClick={onModalClose}>
                Close
              </Button>
              <Button variant="ghost">Secondary Action</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Positioner>
      </Modal.Root>

      {/* AlertDialog */}
      <AlertDialog.Root
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onAlertClose}
      >
        <AlertDialog.Backdrop />
        <AlertDialog.Positioner>
          <AlertDialog.Content>
            <AlertDialog.Header fontSize="lg" fontWeight="bold">
              Delete Customer
            </AlertDialog.Header>
            <AlertDialog.Body>
              Are you sure? You can't undo this action afterwards.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button ref={cancelRef} onClick={onAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={onAlertClose} ml={3}>
                Delete
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Positioner>
      </AlertDialog.Root>

      {/* Drawer */}
      <Drawer.Root
        isOpen={isDrawerOpen}
        placement="right"
        onClose={onDrawerClose}
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>Drawer Title</Drawer.Header>
            <Drawer.Body>
              <p>This is the drawer body.</p>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </VStack>
  );
}
