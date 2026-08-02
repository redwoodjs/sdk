"use client";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Html } from "@react-email/html";
import { Preview } from "@react-email/preview";

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
