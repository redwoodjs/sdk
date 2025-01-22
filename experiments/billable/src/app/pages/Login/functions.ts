'use server';

import { Resend } from 'resend';
import { getEnv } from '../../../lib';
import { db } from '../../../db';

import crypto from 'node:crypto'

export async function generateAuthToken(email: string) {

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  await db.user.upsert({
    where: { email },
    create: {
      email,
      authToken: token,
      authTokenExpiresAt: expiresAt
    },
    update: {
      authToken: token,
      authTokenExpiresAt: expiresAt
    }
  });

  return token;
}

export async function sendEmail(email: string) {
  const token = await generateAuthToken(email);
  const loginUrl = `${process.env.APP_URL}/auth?token=${token}&email=${encodeURIComponent(email)}`;

  const resend = new Resend(getEnv().RESEND_API_KEY);
  await resend.emails.send({
    from: 'auth@billable.me',
    to: email,
    subject: 'Login to Billable',
    html: `
      <h1>Login to Billable</h1>
      <p>Click the link below to log in to your account:</p>
      <a href="${loginUrl}">Login to Billable</a>
      <p>This link will expire in 24 hours.</p>
    `
  });
}
