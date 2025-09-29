"use server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type Authenticator,
} from "@simplewebauthn/server";
import { sessionStore } from "../session/store.js";
import { requestInfo } from "rwsdk/worker";
import { env } from "cloudflare:workers";
import type { PasskeyDurableObject } from "./durableObject.js";
import { CloudflareEnv } from "@/types/cloudflare";

const getPasskeyDO = () => {
  const passkeyDO = (env as CloudflareEnv)
    .PASSKEY_DURABLE_OBJECT as DurableObjectNamespace<PasskeyDurableObject>;
  // We use a fixed ID to ensure we always hit the same DO instance.
  const singletonId = passkeyDO.idFromName("passkey-singleton");
  return passkeyDO.get(singletonId);
};

const getWebAuthnConfig = (req: Request) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const isDev = url.hostname === "localhost";
  const rpID = isDev ? "localhost" : (env as CloudflareEnv).WEBAUTHN_RP_ID;
  const rpName = (env as CloudflareEnv).WEBAUTHN_APP_NAME;
  return { rpName, rpID, origin };
};

export async function startPasskeyRegistration(username: string) {
  const passkeyDO = getPasskeyDO();
  let user = await passkeyDO.getUser(username);

  if (!user) {
    user = await passkeyDO.createUser(username);
  }

  const { rpName, rpID, origin } = getWebAuthnConfig(requestInfo.request);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.username,
    attestationType: "none",
    excludeCredentials: user.authenticators.map((auth) => ({
      id: auth.credentialID,
      type: "public-key",
      transports: auth.transports,
    })),
  });

  await sessionStore.save(requestInfo.response.headers, {
    challenge: options.challenge,
    username,
  });

  return options;
}

export async function startPasskeyLogin(username: string) {
  const passkeyDO = getPasskeyDO();
  const user = await passkeyDO.getUser(username);

  if (!user) {
    throw new Error("User not found");
  }

  const { rpName, rpID } = getWebAuthnConfig(requestInfo.request);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.authenticators.map((auth) => ({
      id: auth.credentialID,
      type: "public-key",
      transports: auth.transports,
    })),
  });

  await sessionStore.save(requestInfo.response.headers, {
    challenge: options.challenge,
    username,
  });

  return options;
}

export async function finishPasskeyRegistration(
  registration: RegistrationResponseJSON,
) {
  const { rpID, origin } = getWebAuthnConfig(requestInfo.request);
  const session = await sessionStore.load(requestInfo.request);

  if (!session?.challenge || !session.username) {
    throw new Error("Challenge or username not found in session");
  }

  const verification = await verifyRegistrationResponse({
    response: registration,
    expectedChallenge: session.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });

  if (verification.verified && verification.registrationInfo) {
    const passkeyDO = getPasskeyDO();
    await passkeyDO.addAuthenticator(
      session.username,
      verification.registrationInfo,
    );
    await sessionStore.save(requestInfo.response.headers, {
      challenge: null,
      username: null,
    });
    return true;
  }

  return false;
}

export async function finishPasskeyLogin(login: AuthenticationResponseJSON) {
  const { rpID, origin } = getWebAuthnConfig(requestInfo.request);
  const session = await sessionStore.load(requestInfo.request);
  const passkeyDO = getPasskeyDO();

  if (!session?.challenge) {
    throw new Error("Challenge not found in session");
  }

  const result = await passkeyDO.getAuthenticator(login.id);

  if (!result) {
    throw new Error("Authenticator not found");
  }

  const { user, authenticator } = result;

  const verification = await verifyAuthenticationResponse({
    response: login,
    expectedChallenge: session.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator,
    requireUserVerification: false,
  });

  if (verification.verified) {
    await passkeyDO.updateAuthenticatorCounter(
      login.id,
      verification.authenticationInfo.newCounter,
    );

    await sessionStore.save(requestInfo.response.headers, {
      userId: user.id,
      challenge: null,
      username: null,
    });

    return true;
  }

  return false;
}
