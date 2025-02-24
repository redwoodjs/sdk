"use server";
import { generateRegistrationOptions } from '@simplewebauthn/server';

import { sessions } from "@/session/store";
import { RouteContext } from '@redwoodjs/sdk/router';

export async function generatePasskeyRegistrationOptions(username: string, ctx?: RouteContext) {
  const { request, headers, env } = ctx!;
  const { origin } = new URL(request.url);

  const options = await generateRegistrationOptions({
    rpName: env.APP_NAME,
    rpID: origin,
    userName: username,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  await sessions.save(headers, { challenge: options.challenge });

  return options;
}
