"use client";

import { Accordion } from "@mantine/core";

export function ExampleAccordion() {
  return (
    <Accordion defaultValue="customization">
      <Accordion.Item value="customization">
        <Accordion.Control>Customization</Accordion.Control>
        <Accordion.Panel>
          Colors, fonts, shadows and many other parts are customizable to fit
          your design needs
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="flexibility">
        <Accordion.Control>Flexibility</Accordion.Control>
        <Accordion.Panel>
          Configure components padding and margins and define other styles with
          honstants. Tune number of components variants to hugs documentation
          and code.
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
