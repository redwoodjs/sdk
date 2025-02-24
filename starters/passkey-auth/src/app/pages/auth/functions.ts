"use server";
import { server } from '@passwordless-id/webauthn'


import { sessions } from "@/session/store";
import { RouteContext } from '@redwoodjs/sdk/router';

export async function createChallenge(ctx?: RouteContext) {
  const { headers } = ctx!;

  const challenge = server.randomChallenge();
  sessions.save(headers, { challenge });

  return challenge
}