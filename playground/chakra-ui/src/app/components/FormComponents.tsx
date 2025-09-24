"use client";

import {
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  NumberInput,
  PinInput,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
  VStack,
} from "@chakra-ui/react";

export function FormComponents() {
  return (
    <VStack gap={8} alignItems="flex-start">
      <FormControl>
        <FormLabel>Basic Input</FormLabel>
        <Input placeholder="Enter details" data-testid="basic-input" />
        <FormHelperText>This is a helper text.</FormHelperText>
      </FormControl>

      <HStack gap={8}>
        <FormControl>
          <FormLabel>Checkbox</FormLabel>
          <Checkbox data-testid="checkbox-single">Single Checkbox</Checkbox>
        </FormControl>

        <FormControl>
          <FormLabel>Radio Group</FormLabel>
          <RadioGroup defaultValue="1">
            <HStack>
              <Radio value="1">First</Radio>
              <Radio value="2">Second</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>
      </HStack>

      <FormControl>
        <FormLabel>Select</FormLabel>
        <Select placeholder="Select option">
          <option value="option1">Option 1</option>
          <option value="option2">Option 2</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Number Input</FormLabel>
        <NumberInput.Root defaultValue={15}>
          <NumberInput.Field />
          <NumberInput.Stepper>
            <NumberInput.IncrementStepper />
            <NumberInput.DecrementStepper />
          </NumberInput.Stepper>
        </NumberInput.Root>
      </FormControl>

      <FormControl>
        <FormLabel>Pin Input</FormLabel>
        <HStack>
          <PinInput.Root>
            <PinInput.Field />
            <PinInput.Field />
            <PinInput.Field />
          </PinInput.Root>
        </HStack>
      </FormControl>

      <FormControl>
        <FormLabel>Slider</FormLabel>
        <Slider.Root defaultValue={30}>
          <Slider.Track>
            <Slider.FilledTrack />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Root>
      </FormControl>

      <FormControl>
        <FormLabel>Switch</FormLabel>
        <Switch />
      </FormControl>

      <Button colorScheme="blue">Submit</Button>
    </VStack>
  );
}
