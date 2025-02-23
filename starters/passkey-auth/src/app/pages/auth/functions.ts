"use server";
import { server } from '@passwordless-id/webauthn'


import { sessions } from "@/session/store";
import { db } from '@/db';

export async function startPasskeyLogin(email: string, { headers }: { headers: Headers }) {
  const user = await db.user.findUnique({ where: { email } });

  if (user) {
    // todo
    throw new Error('Not implemented');
  }

  const challenge = await getChallenge();
  sessions.save(headers, { challenge });

  return {
    challenge,
  }
}

export async function getChallenge() {
  return server.randomChallenge();
}