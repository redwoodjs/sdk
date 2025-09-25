"use client";

import React from "react";
import "@react-email/render";
import { Resend } from "resend";
import WelcomeEmail from "./WelcomeEmail";

export const ssrSendWelcomeEmail = async (apiKey: string, email: string) => {
  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: "Acme <onboarding@resend.dev>",
    to: email,
    subject: "👋 Welcome",
    react: React.createElement(WelcomeEmail, { name: email }),
  });

  return result;
};
