"use client";

import * as React from "react";
import { Accordion } from "@base-ui-components/react/accordion";
import { AlertDialog } from "@base-ui-components/react/alert-dialog";
import { Avatar } from "@base-ui-components/react/avatar";
import { Checkbox } from "@base-ui-components/react/checkbox";
import { CheckboxGroup } from "@base-ui-components/react/checkbox-group";
import { Collapsible } from "@base-ui-components/react/collapsible";
import { Dialog } from "@base-ui-components/react/dialog";
import { Field } from "@base-ui-components/react/field";
import { Fieldset } from "@base-ui-components/react/fieldset";
import { Input } from "@base-ui-components/react/input";
import { Menu } from "@base-ui-components/react/menu";
import { NumberField } from "@base-ui-components/react/number-field";
import { Popover } from "@base-ui-components/react/popover";
import { Progress } from "@base-ui-components/react/progress";
import { Radio } from "@base-ui-components/react/radio";
import { Select } from "@base-ui-components/react/select";
import { Separator } from "@base-ui-components/react/separator";
import { Slider } from "@base-ui-components/react/slider";
import { Switch } from "@base-ui-components/react/switch";
import { Tabs } from "@base-ui-components/react/tabs";
import { Toggle } from "@base-ui-components/react/toggle";
import { ToggleGroup } from "@base-ui-components/react/toggle-group";
import { Tooltip } from "@base-ui-components/react/tooltip";

export function ComponentShowcase() {
  const [accordionValue, setAccordionValue] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = React.useState(false);
  const [collapsibleOpen, setCollapsibleOpen] = React.useState(false);
  const [checkboxChecked, setCheckboxChecked] = React.useState(false);
  const [checkboxGroupValue, setCheckboxGroupValue] = React.useState<string[]>(
    [],
  );
  const [radioValue, setRadioValue] = React.useState("");
  const [switchChecked, setSwitchChecked] = React.useState(false);
  const [togglePressed, setTogglePressed] = React.useState(false);
  const [toggleGroupValue, setToggleGroupValue] = React.useState<string[]>([]);
  const [sliderValue, setSliderValue] = React.useState([50]);
  const [numberValue, setNumberValue] = React.useState(0);
  const [inputValue, setInputValue] = React.useState("");
  const [selectValue, setSelectValue] = React.useState("");
  const [tabsValue, setTabsValue] = React.useState("tab1");

  return (
    <div className="space-y-8">
      {/* Accordion */}
      <section className="component-section" data-testid="accordion-section">
        <h2>Accordion</h2>
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
            <Accordion.Item value="item2">
              <Accordion.Header>
                <Accordion.Trigger className="demo-button">
                  How do I use it?
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>
                <div className="p-4">
                  Install the package and import the components you need.
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </section>

      {/* Alert Dialog */}
      <section className="component-section" data-testid="alert-dialog-section">
        <h2>Alert Dialog</h2>
        <div className="component-demo">
          <AlertDialog.Root
            open={alertDialogOpen}
            onOpenChange={setAlertDialogOpen}
          >
            <AlertDialog.Trigger
              className="demo-button"
              data-testid="alert-dialog-trigger"
            >
              Delete Account
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 bg-black bg-opacity-50" />
              <AlertDialog.Popup
                className="demo-popup fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                data-testid="alert-dialog"
              >
                <AlertDialog.Title className="font-semibold mb-2">
                  Are you sure?
                </AlertDialog.Title>
                <AlertDialog.Description className="text-gray-600 mb-4">
                  This action cannot be undone. This will permanently delete
                  your account.
                </AlertDialog.Description>
                <div className="flex gap-2">
                  <AlertDialog.Close className="demo-button">
                    Cancel
                  </AlertDialog.Close>
                  <AlertDialog.Close className="demo-button bg-red-500">
                    Delete
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </section>

      {/* Avatar */}
      <section className="component-section" data-testid="avatar-section">
        <h2>Avatar</h2>
        <div className="component-demo">
          <div className="flex gap-4 items-center">
            <Avatar.Root
              className="w-12 h-12 rounded-full overflow-hidden bg-gray-200"
              data-testid="avatar"
            >
              <Avatar.Image
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                alt="User avatar"
                className="w-full h-full object-cover"
              />
              <Avatar.Fallback className="w-full h-full flex items-center justify-center text-gray-600">
                JD
              </Avatar.Fallback>
            </Avatar.Root>
            <Avatar.Root
              className="w-12 h-12 rounded-full overflow-hidden bg-gray-200"
              data-testid="avatar-fallback"
            >
              <Avatar.Image
                src="invalid-url"
                alt="User avatar"
                className="w-full h-full object-cover"
              />
              <Avatar.Fallback className="w-full h-full flex items-center justify-center text-gray-600">
                AB
              </Avatar.Fallback>
            </Avatar.Root>
          </div>
        </div>
      </section>

      {/* Checkbox */}
      <section className="component-section" data-testid="checkbox-section">
        <h2>Checkbox</h2>
        <div className="component-demo">
          <Field.Root>
            <div className="flex items-center gap-2">
              <Checkbox.Root
                checked={checkboxChecked}
                onCheckedChange={setCheckboxChecked}
                className="demo-checkbox"
                data-testid="checkbox"
              >
                <Checkbox.Indicator>✓</Checkbox.Indicator>
              </Checkbox.Root>
              <Field.Label>Accept terms and conditions</Field.Label>
            </div>
          </Field.Root>
        </div>
      </section>

      {/* Checkbox Group */}
      <section
        className="component-section"
        data-testid="checkbox-group-section"
      >
        <h2>Checkbox Group</h2>
        <div className="component-demo">
          <CheckboxGroup.Root
            value={checkboxGroupValue}
            onValueChange={setCheckboxGroupValue}
            data-testid="checkbox-group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CheckboxGroup.Item value="react" className="demo-checkbox">
                  <Checkbox.Indicator>✓</Checkbox.Indicator>
                </CheckboxGroup.Item>
                <label>React</label>
              </div>
              <div className="flex items-center gap-2">
                <CheckboxGroup.Item value="vue" className="demo-checkbox">
                  <Checkbox.Indicator>✓</Checkbox.Indicator>
                </CheckboxGroup.Item>
                <label>Vue</label>
              </div>
              <div className="flex items-center gap-2">
                <CheckboxGroup.Item value="angular" className="demo-checkbox">
                  <Checkbox.Indicator>✓</Checkbox.Indicator>
                </CheckboxGroup.Item>
                <label>Angular</label>
              </div>
            </div>
          </CheckboxGroup.Root>
        </div>
      </section>

      {/* Collapsible */}
      <section className="component-section" data-testid="collapsible-section">
        <h2>Collapsible</h2>
        <div className="component-demo">
          <Collapsible.Root
            open={collapsibleOpen}
            onOpenChange={setCollapsibleOpen}
          >
            <Collapsible.Trigger
              className="demo-button"
              data-testid="collapsible-trigger"
            >
              {collapsibleOpen ? "Hide" : "Show"} Details
            </Collapsible.Trigger>
            <Collapsible.Panel data-testid="collapsible-panel">
              <div className="p-4 mt-2 bg-gray-100 rounded">
                This content can be collapsed and expanded.
              </div>
            </Collapsible.Panel>
          </Collapsible.Root>
        </div>
      </section>

      {/* Dialog */}
      <section className="component-section" data-testid="dialog-section">
        <h2>Dialog</h2>
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

      {/* Field & Input */}
      <section className="component-section" data-testid="field-section">
        <h2>Field & Input</h2>
        <div className="component-demo">
          <Field.Root>
            <Field.Label className="block mb-2">Email Address</Field.Label>
            <Input.Root
              value={inputValue}
              onValueChange={setInputValue}
              className="demo-input"
              data-testid="input"
            />
            <Field.Description className="text-sm text-gray-600 mt-1">
              Enter your email address
            </Field.Description>
          </Field.Root>
        </div>
      </section>

      {/* Menu */}
      <section className="component-section" data-testid="menu-section">
        <h2>Menu</h2>
        <div className="component-demo">
          <Menu.Root>
            <Menu.Trigger className="demo-button" data-testid="menu-trigger">
              Options
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup className="demo-popup" data-testid="menu">
                  <Menu.Item className="p-2 hover:bg-gray-100 cursor-pointer">
                    Edit
                  </Menu.Item>
                  <Menu.Item className="p-2 hover:bg-gray-100 cursor-pointer">
                    Copy
                  </Menu.Item>
                  <Menu.Separator className="border-t my-1" />
                  <Menu.Item className="p-2 hover:bg-gray-100 cursor-pointer text-red-600">
                    Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </section>

      {/* Number Field */}
      <section className="component-section" data-testid="number-field-section">
        <h2>Number Field</h2>
        <div className="component-demo">
          <NumberField.Root
            value={numberValue}
            onValueChange={setNumberValue}
            data-testid="number-field"
          >
            <Field.Label>Quantity</Field.Label>
            <div className="flex">
              <NumberField.Decrement className="demo-button">
                -
              </NumberField.Decrement>
              <NumberField.Input
                className="demo-input mx-2 text-center"
                style={{ width: "80px" }}
              />
              <NumberField.Increment className="demo-button">
                +
              </NumberField.Increment>
            </div>
          </NumberField.Root>
        </div>
      </section>

      {/* Popover */}
      <section className="component-section" data-testid="popover-section">
        <h2>Popover</h2>
        <div className="component-demo">
          <Popover.Root>
            <Popover.Trigger
              className="demo-button"
              data-testid="popover-trigger"
            >
              Show Info
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={8}>
                <Popover.Popup className="demo-popup" data-testid="popover">
                  <Popover.Arrow className="demo-arrow">
                    <svg width="20" height="10" viewBox="0 0 20 10">
                      <path d="M0 10L10 0L20 10" fill="white" stroke="#ccc" />
                    </svg>
                  </Popover.Arrow>
                  <Popover.Title className="font-semibold">
                    Information
                  </Popover.Title>
                  <Popover.Description>
                    This is additional information in a popover.
                  </Popover.Description>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </section>

      {/* Progress */}
      <section className="component-section" data-testid="progress-section">
        <h2>Progress</h2>
        <div className="component-demo">
          <Progress.Root value={75} className="w-full" data-testid="progress">
            <Progress.Track className="bg-gray-200 h-2 rounded">
              <Progress.Indicator
                className="bg-blue-500 h-full rounded transition-all duration-300"
                style={{ width: "75%" }}
              />
            </Progress.Track>
          </Progress.Root>
          <div className="text-sm text-gray-600 mt-1">75% complete</div>
        </div>
      </section>

      {/* Radio */}
      <section className="component-section" data-testid="radio-section">
        <h2>Radio</h2>
        <div className="component-demo">
          <Radio.Root
            value={radioValue}
            onValueChange={setRadioValue}
            data-testid="radio-group"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Radio.Item value="small" className="demo-checkbox">
                  <Radio.Indicator>•</Radio.Indicator>
                </Radio.Item>
                <label>Small</label>
              </div>
              <div className="flex items-center gap-2">
                <Radio.Item value="medium" className="demo-checkbox">
                  <Radio.Indicator>•</Radio.Indicator>
                </Radio.Item>
                <label>Medium</label>
              </div>
              <div className="flex items-center gap-2">
                <Radio.Item value="large" className="demo-checkbox">
                  <Radio.Indicator>•</Radio.Indicator>
                </Radio.Item>
                <label>Large</label>
              </div>
            </div>
          </Radio.Root>
        </div>
      </section>

      {/* Select */}
      <section className="component-section" data-testid="select-section">
        <h2>Select</h2>
        <div className="component-demo">
          <Select.Root
            value={selectValue}
            onValueChange={setSelectValue}
            data-testid="select"
          >
            <Select.Trigger className="demo-input flex justify-between items-center">
              <Select.Value placeholder="Choose an option..." />
              <Select.Icon>▼</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup className="demo-popup">
                  <Select.Option
                    value="option1"
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Option 1
                  </Select.Option>
                  <Select.Option
                    value="option2"
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Option 2
                  </Select.Option>
                  <Select.Option
                    value="option3"
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    Option 3
                  </Select.Option>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      </section>

      {/* Separator */}
      <section className="component-section" data-testid="separator-section">
        <h2>Separator</h2>
        <div className="component-demo">
          <div>Content above</div>
          <Separator.Root className="border-t my-4" data-testid="separator" />
          <div>Content below</div>
        </div>
      </section>

      {/* Slider */}
      <section className="component-section" data-testid="slider-section">
        <h2>Slider</h2>
        <div className="component-demo">
          <Slider.Root
            value={sliderValue}
            onValueChange={setSliderValue}
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid="slider"
          >
            <Slider.Track className="bg-gray-200 h-2 rounded relative">
              <Slider.Range className="bg-blue-500 h-full rounded" />
              <Slider.Thumb className="w-4 h-4 bg-white border-2 border-blue-500 rounded-full absolute top-1/2 transform -translate-y-1/2" />
            </Slider.Track>
          </Slider.Root>
          <div className="text-sm text-gray-600 mt-1">
            Value: {sliderValue[0]}
          </div>
        </div>
      </section>

      {/* Switch */}
      <section className="component-section" data-testid="switch-section">
        <h2>Switch</h2>
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

      {/* Tabs */}
      <section className="component-section" data-testid="tabs-section">
        <h2>Tabs</h2>
        <div className="component-demo">
          <Tabs.Root
            value={tabsValue}
            onValueChange={setTabsValue}
            data-testid="tabs"
          >
            <Tabs.List className="flex border-b">
              <Tabs.Tab
                value="tab1"
                className={`p-2 cursor-pointer ${
                  tabsValue === "tab1" ? "border-b-2 border-blue-500" : ""
                }`}
              >
                Tab 1
              </Tabs.Tab>
              <Tabs.Tab
                value="tab2"
                className={`p-2 cursor-pointer ${
                  tabsValue === "tab2" ? "border-b-2 border-blue-500" : ""
                }`}
              >
                Tab 2
              </Tabs.Tab>
              <Tabs.Tab
                value="tab3"
                className={`p-2 cursor-pointer ${
                  tabsValue === "tab3" ? "border-b-2 border-blue-500" : ""
                }`}
              >
                Tab 3
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="tab1" className="p-4">
              Content for Tab 1
            </Tabs.Panel>
            <Tabs.Panel value="tab2" className="p-4">
              Content for Tab 2
            </Tabs.Panel>
            <Tabs.Panel value="tab3" className="p-4">
              Content for Tab 3
            </Tabs.Panel>
          </Tabs.Root>
        </div>
      </section>

      {/* Toggle */}
      <section className="component-section" data-testid="toggle-section">
        <h2>Toggle</h2>
        <div className="component-demo">
          <Toggle.Root
            pressed={togglePressed}
            onPressedChange={setTogglePressed}
            className={`demo-button ${togglePressed ? "bg-blue-600" : ""}`}
            data-testid="toggle"
          >
            {togglePressed ? "ON" : "OFF"}
          </Toggle.Root>
        </div>
      </section>

      {/* Toggle Group */}
      <section className="component-section" data-testid="toggle-group-section">
        <h2>Toggle Group</h2>
        <div className="component-demo">
          <ToggleGroup.Root
            value={toggleGroupValue}
            onValueChange={setToggleGroupValue}
            type="multiple"
            className="flex gap-1"
            data-testid="toggle-group"
          >
            <ToggleGroup.Item
              value="bold"
              className={`demo-button ${
                toggleGroupValue.includes("bold") ? "bg-blue-600" : ""
              }`}
            >
              B
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="italic"
              className={`demo-button ${
                toggleGroupValue.includes("italic") ? "bg-blue-600" : ""
              }`}
            >
              I
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="underline"
              className={`demo-button ${
                toggleGroupValue.includes("underline") ? "bg-blue-600" : ""
              }`}
            >
              U
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
      </section>

      {/* Tooltip */}
      <section className="component-section" data-testid="tooltip-section">
        <h2>Tooltip</h2>
        <div className="component-demo">
          <Tooltip.Root>
            <Tooltip.Trigger
              className="demo-button"
              data-testid="tooltip-trigger"
            >
              Hover me
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup
                  className="bg-black text-white px-2 py-1 rounded text-sm"
                  data-testid="tooltip"
                >
                  This is a tooltip
                  <Tooltip.Arrow className="text-black">▼</Tooltip.Arrow>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </section>
    </div>
  );
}
