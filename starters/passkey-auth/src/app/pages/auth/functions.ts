"use server";
import { server } from '@passwordless-id/webauthn'


import { sessions } from "@/session/store";
import { RouteContext } from '@redwoodjs/sdk/router';
import { AuthenticationJSON } from '@passwordless-id/webauthn/dist/esm/types';

export async function startPasskeyLogin(ctx?: RouteContext) {
  const { headers } = ctx!;

  const challenge = await getChallenge();
  sessions.save(headers, { challenge });

  return challenge
}

export async function finishPasskeyLogin(authentication: AuthenticationJSON, ctx?: RouteContext) {
  const { headers } = ctx!;

  server.verifyAuthentication(authentication);
}

export async function getChallenge() {
  return server.randomChallenge();
}