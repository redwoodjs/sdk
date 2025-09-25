"use client";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
} from "@react-email/components";

export default function WelcomeEmail({ name }: { name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Hello</Preview>
      <Body>
        <Container>
          <Heading>Hello</Heading>
        </Container>
      </Body>
    </Html>
  );
}
