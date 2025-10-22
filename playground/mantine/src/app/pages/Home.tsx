import { Container, Stack, Title } from "@mantine/core";
import { RequestInfo } from "rwsdk/worker";
import { ExampleAccordion } from "../components/ExampleAccordion.js";
import { ExampleDialog } from "../components/ExampleDialog.js";
import { ExampleSwitch } from "../components/ExampleSwitch.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <Container>
      <Stack>
        <Title>Mantine Playground</Title>
        <ExampleAccordion />
        <ExampleDialog />
        <ExampleSwitch />
      </Stack>
    </Container>
  );
}
