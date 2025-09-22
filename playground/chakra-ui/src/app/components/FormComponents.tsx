"use client";

import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  Input,
  InputGroup,
  InputLeftAddon,
  InputRightAddon,
  InputLeftElement,
  InputRightElement,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  PinInput,
  PinInputField,
  Radio,
  RadioGroup,
  Select,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Switch,
  Textarea,
  VStack,
  HStack,
  Stack,
  Heading,
  Text,
  Icon,
} from "@chakra-ui/react";
import { useState } from "react";

export function FormComponents() {
  const [inputValue, setInputValue] = useState("");
  const [numberValue, setNumberValue] = useState(0);
  const [radioValue, setRadioValue] = useState("1");
  const [checkboxValues, setCheckboxValues] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState(50);
  const [switchValue, setSwitchValue] = useState(false);
  const [textareaValue, setTextareaValue] = useState("");
  const [selectValue, setSelectValue] = useState("");

  return (
    <VStack spacing={8} align="stretch">
      {/* Input */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="input-heading">
          Input
        </Heading>
        <VStack spacing={4} align="stretch">
          <FormControl data-testid="basic-input">
            <FormLabel>Basic Input</FormLabel>
            <Input
              placeholder="Enter some text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <FormHelperText>This is a helper text</FormHelperText>
          </FormControl>

          <FormControl data-testid="input-with-addons">
            <FormLabel>Input with Addons</FormLabel>
            <InputGroup>
              <InputLeftAddon>https://</InputLeftAddon>
              <Input placeholder="website.com" />
              <InputRightAddon>.com</InputRightAddon>
            </InputGroup>
          </FormControl>

          <FormControl data-testid="input-with-elements">
            <FormLabel>Input with Elements</FormLabel>
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Text color="gray.300">$</Text>
              </InputLeftElement>
              <Input placeholder="Enter amount" />
              <InputRightElement>
                <Text color="gray.300">USD</Text>
              </InputRightElement>
            </InputGroup>
          </FormControl>
        </VStack>
      </Box>

      {/* Button */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="button-heading">
          Button
        </Heading>
        <HStack spacing={4} wrap="wrap">
          <Button colorScheme="blue" data-testid="button-solid">
            Solid Button
          </Button>
          <Button
            variant="outline"
            colorScheme="blue"
            data-testid="button-outline"
          >
            Outline Button
          </Button>
          <Button variant="ghost" colorScheme="blue" data-testid="button-ghost">
            Ghost Button
          </Button>
          <Button variant="link" colorScheme="blue" data-testid="button-link">
            Link Button
          </Button>
          <Button size="sm" data-testid="button-small">
            Small
          </Button>
          <Button size="lg" data-testid="button-large">
            Large
          </Button>
          <Button isLoading data-testid="button-loading">
            Loading
          </Button>
          <Button isDisabled data-testid="button-disabled">
            Disabled
          </Button>
        </HStack>
      </Box>

      {/* Checkbox */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="checkbox-heading">
          Checkbox
        </Heading>
        <VStack spacing={4} align="stretch">
          <Checkbox defaultChecked data-testid="checkbox-single">
            Single Checkbox
          </Checkbox>

          <CheckboxGroup
            value={checkboxValues}
            onChange={(values) => setCheckboxValues(values as string[])}
            data-testid="checkbox-group"
          >
            <Stack spacing={2}>
              <Checkbox value="option1">Option 1</Checkbox>
              <Checkbox value="option2">Option 2</Checkbox>
              <Checkbox value="option3">Option 3</Checkbox>
            </Stack>
          </CheckboxGroup>
        </VStack>
      </Box>

      {/* Radio */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="radio-heading">
          Radio
        </Heading>
        <RadioGroup
          value={radioValue}
          onChange={setRadioValue}
          data-testid="radio-group"
        >
          <Stack spacing={2}>
            <Radio value="1">First</Radio>
            <Radio value="2">Second</Radio>
            <Radio value="3">Third</Radio>
          </Stack>
        </RadioGroup>
      </Box>

      {/* Select */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="select-heading">
          Select
        </Heading>
        <FormControl data-testid="select-form">
          <FormLabel>Select Option</FormLabel>
          <Select
            placeholder="Choose an option"
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          >
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </Select>
        </FormControl>
      </Box>

      {/* NumberInput */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="number-input-heading">
          NumberInput
        </Heading>
        <FormControl data-testid="number-input-form">
          <FormLabel>Number Input</FormLabel>
          <NumberInput
            value={numberValue}
            onChange={(valueString) =>
              setNumberValue(parseInt(valueString) || 0)
            }
            min={0}
            max={100}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
      </Box>

      {/* PinInput */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="pin-input-heading">
          PinInput
        </Heading>
        <FormControl data-testid="pin-input-form">
          <FormLabel>PIN Input</FormLabel>
          <HStack>
            <PinInput>
              <PinInputField />
              <PinInputField />
              <PinInputField />
              <PinInputField />
            </PinInput>
          </HStack>
        </FormControl>
      </Box>

      {/* Slider */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="slider-heading">
          Slider
        </Heading>
        <FormControl data-testid="slider-form">
          <FormLabel>Slider (Value: {sliderValue})</FormLabel>
          <Slider
            value={sliderValue}
            onChange={setSliderValue}
            min={0}
            max={100}
            step={1}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </FormControl>
      </Box>

      {/* Switch */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="switch-heading">
          Switch
        </Heading>
        <FormControl
          display="flex"
          alignItems="center"
          data-testid="switch-form"
        >
          <FormLabel htmlFor="email-alerts" mb="0">
            Enable notifications
          </FormLabel>
          <Switch
            id="email-alerts"
            isChecked={switchValue}
            onChange={(e) => setSwitchValue(e.target.checked)}
          />
        </FormControl>
      </Box>

      {/* Textarea */}
      <Box>
        <Heading as="h3" size="md" mb={4} data-testid="textarea-heading">
          Textarea
        </Heading>
        <FormControl data-testid="textarea-form">
          <FormLabel>Textarea</FormLabel>
          <Textarea
            placeholder="Enter your message here"
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
            resize="vertical"
          />
        </FormControl>
      </Box>
    </VStack>
  );
}
