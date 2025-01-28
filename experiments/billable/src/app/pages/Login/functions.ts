"use server";

import { Resend } from "resend";
import { getEnv } from "../../../env";
import { db } from "../../../db";

export async function generateAuthToken(email: string) {
  const authToken = crypto.randomUUID();
  const authTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  console.log('this does not hang...')
  console.log(authToken, authTokenExpiresAt)

  console.log('this hangs...')
  const user = await db.user.findUnique({ where: { email }})
  console.log('found', user)
  // if (user) {
  //   await db.user.update({
  //     where: { email },
  //     data: {
  //       authToken,
  //       authTokenExpiresAt
  //     }
  //   })
  // } else {
  //   await db.user.create({
  //     data :{
  //       email,
  //       authToken,
  //       authTokenExpiresAt,
  //     }
  //   })
  // }
  return authToken;
}

export async function sendEmail(email: string) {
  const token = await generateAuthToken(email);
  console.log('xxx', token)

  const loginUrl = `${process.env.APP_URL}/auth?token=${token}&email=${encodeURIComponent(email)}`;
  console.log(token, loginUrl)

  // const resend = new Resend(getEnv().RESEND_API_KEY);
  // await resend.emails.send({
  //   from: "auth@billable.me",
  //   to: email,
  //   subject: "Login to Billable",
  //   html: `
  //   <h1>Login to Billable</h1>
  //   <p>Click the link below to log in to your account:</p>
  //   <a href="${loginUrl}">Login to Billable</a>
  //   <p>This link will expire in 24 hours.</p>
  // `,
  // });
}
