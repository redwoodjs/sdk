"use server";
import { server } from '@passwordless-id/webauthn'


import { sessions } from "@/session/store";
import { RouteContext } from '@redwoodjs/sdk/router';

export async function startPasskeyLogin(ctx?: RouteContext) {
  const { headers } = ctx!;

  const challenge = await getChallenge();
  sessions.save(headers, { challenge });

  return challenge
}

export async function getChallenge() {
  return server.randomChallenge();
}