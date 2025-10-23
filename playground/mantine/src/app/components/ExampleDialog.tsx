"use client";

import { Button, Group, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export function ExampleDialog() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Modal opened={opened} onClose={close} title="This is a dialog">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nonne
          merninisti licere mihi ista probare, quae sunt a te dicta? Refert
          tamen, quo modo.
        </p>
      </Modal>

      <Group>
        <Button onClick={open}>Open Dialog</Button>
      </Group>
    </>
  );
}
