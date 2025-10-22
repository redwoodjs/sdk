import { Container, Stack, Title } from "@mantine/core";
import { RequestInfo } from "rwsdk/worker";
import { ExampleAccordion } from "../components/ExampleAccordion.js";
import { ExampleDialog } from "../components/ExampleDialog.js";
import { ExampleSwitch } from "../components/ExampleSwitch.js";

export function Home({ ctx }: RequestInfo) {
  return (
    <Container>
      <Stack>
        <Title data-testid="main-title">Mantine Playground</Title>
        <p data-testid="subtitle">A simple component showcase for RedwoodSDK</p>
        <div data-testid="accordion-section">
          <ExampleAccordion />
        </div>
        <div data-testid="dialog-section">
          <ExampleDialog />
        </div>
        <div data-testid="switch-section">
          <ExampleSwitch />
        </div>
      </Stack>
    </Container>
  );
}
