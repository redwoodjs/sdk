"use server";

import { Resend } from "resend";
import { getEnv } from "../../../env";
import { db } from "../../../db";
import { link } from "../../shared/links";

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

export async function emailLoginLink(email: string) {
  console.log('### generateAuthToken')
  const token = await generateAuthToken(email);
  console.log('### generateAuthToken done')


  const loginUrl = `${getEnv().APP_URL}${link('/user/auth')}?token=${token}&email=${encodeURIComponent(email)}`;
  console.log('### loginUrl', loginUrl)
  const resend = new Resend(getEnv().RESEND_API_KEY);
  console.log('### resend')
  await resend.emails.send({
    from: "Griffon <auth@griffon.com>",
    to: email,
    subject: `Login to Griffon ${new Date().toLocaleTimeString()}`,
    html: `
    <h1>Login to Griffon</h1>
    <p>Click the link to log in to your account:</p>
    <a href="${loginUrl}">Login to Griffon</a>
    <p>This link will expire in 24 hours.</p>
  `,
  });
  console.log('### resend done')
}
