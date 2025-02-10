"use server";

import { Resend } from "resend";
import { getEnv } from "../../../env";
import { link } from "../../shared/links";
import { db, RouteContext } from "@redwoodjs/reloaded/worker";

export async function generateAuthToken(email: string) {
  const authToken = Math.floor(100000 + Math.random() * 900000).toString();
  const authTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  await db.user.upsert({
    where: { email },
    update: {
      authToken,
      authTokenExpiresAt
    },
    create: {
      email,
      authToken,
      authTokenExpiresAt,
    }
  })
  return authToken;
}

export async function emailLoginLink(email: string, ctx: RouteContext) {
  console.log('### generateAuthToken')
  const token = await generateAuthToken(email);
  console.log('### generateAuthToken done')


  console.log('### ctx', ctx)
  const { env } = ctx;
  console.log('### env', env)
  const loginUrl = `${env.APP_URL}${link('/user/auth')}?token=${token}&email=${encodeURIComponent(email)}`;
  console.log('### loginUrl', loginUrl)
  const resend = new Resend(env.RESEND_API_KEY);
  console.log('### resend')
  await resend.emails.send({
    from: "Billable <auth@billable.me>",
    to: email,
    subject: `Login to Billable ${new Date().toLocaleTimeString()}`,
    html: `
    <h1>Login to Billable</h1>
    <p>Click the link to log in to your account:</p>
    <a href="${loginUrl}">Login to Billable</a>
    <p>This link will expire in 24 hours.</p>
  `,
  });
  console.log('### resend done')
}
