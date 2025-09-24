"use client";

import * as React from "react";
import { Accordion } from "@base-ui-components/react/accordion";
import { Dialog } from "@base-ui-components/react/dialog";
import { Switch } from "@base-ui-components/react/switch";

export function ClientShowcase() {
  const [accordionValue, setAccordionValue] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [switchChecked, setSwitchChecked] = React.useState(false);

  return (
    <div className="space-y-8">
      {/* Accordion */}
      <section className="component-section" data-testid="accordion-section">
        <h2 className="text-xl font-semibold mb-4">Accordion</h2>
        <div className="component-demo">
          <Accordion.Root
            value={accordionValue}
            onValueChange={setAccordionValue}
            data-testid="accordion"
          >
            <Accordion.Item value="item1">
              <Accordion.Header>
                <Accordion.Trigger className="demo-button">
                  What is Base UI?
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>
                <div className="p-4">
                  Base UI is a library of headless UI components for React.
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </section>

      {/* Dialog */}
      <section className="component-section" data-testid="dialog-section">
        <h2 className="text-xl font-semibold mb-4">Dialog</h2>
        <div className="component-demo">
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger
              className="demo-button"
              data-testid="dialog-trigger"
            >
              Open Dialog
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 bg-black bg-opacity-50" />
              <Dialog.Popup
                className="demo-popup fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                data-testid="dialog"
              >
                <Dialog.Title className="font-semibold mb-2">
                  Dialog Title
                </Dialog.Title>
                <Dialog.Description className="text-gray-600 mb-4">
                  This is a dialog description.
                </Dialog.Description>
                <Dialog.Close className="demo-button">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </section>

      {/* Switch */}
      <section className="component-section" data-testid="switch-section">
        <h2 className="text-xl font-semibold mb-4">Switch</h2>
        <div className="component-demo">
          <div className="flex items-center gap-2">
            <Switch.Root
              checked={switchChecked}
              onCheckedChange={setSwitchChecked}
              className={`w-12 h-6 rounded-full transition-colors ${
                switchChecked ? "bg-blue-500" : "bg-gray-300"
              }`}
              data-testid="switch"
            >
              <Switch.Thumb
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  switchChecked ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </Switch.Root>
            <label>Enable notifications</label>
          </div>
        </div>
      </section>
    </div>
  );
}
