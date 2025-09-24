"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export const DropdownComponent = () => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button>Open Dropdown</button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Item 1</DropdownMenu.Item>
          <DropdownMenu.Item>Item 2</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
