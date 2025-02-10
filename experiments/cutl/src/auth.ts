import { MAX_TOKEN_DURATION } from './constants';
import { ErrorResponse } from './error';
import { SessionDO } from './session';

import { link } from './app/shared/links'
interface SessionIdParts {
  unsignedSessionId: string;
  signature: string;
}

const packSessionId = (parts: SessionIdParts): string => {
  const str = [parts.unsignedSessionId, parts.signature].join(':');
  // Replace URL-unsafe characters in base64
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const unpackSessionId = (packed: string): SessionIdParts => {
  try {
    // Restore base64 padding
    const base64 = packed
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(packed.length + (4 - (packed.length % 4)) % 4, '=');
    
    const decoded = atob(base64);
    const [unsignedSessionId, signature] = decoded.split(':');
    
    if (!unsignedSessionId || !signature) {
      throw new Error('Invalid session format');
    }
    
    return { unsignedSessionId, signature };
  } catch (error) {
    console.error('Session decode error:', {
      packed,
      error: error instanceof Error ? error.message : error
    });
    throw new ErrorResponse(401, 'Invalid session format');
  }
}

export const performLogin = async (request: Request, env: Env, userId: string) => {
  const sessionId = await generateSessionId(env);
  const doId = env.SESSION_DO.idFromName(sessionId);
  const sessionDO = env.SESSION_DO.get(doId) as DurableObjectStub<SessionDO>;
  await sessionDO.saveSession(userId);

  const cookie = `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_TOKEN_DURATION}`;

  return new Response(null, {
    status: 301,
    headers: {
      'Location': link('/project/list'),
      "Set-Cookie": cookie,
      "Content-Type": "text/html"
    },
  });
}

const signSessionId = async (sessionId: string, env: Env) => {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureArrayBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(sessionId)
  );

  return arrayBufferToHex(signatureArrayBuffer);
}

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const array = new Uint8Array(buffer);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const generateSessionId = async (env: Env) => {
  const unsignedSessionId = crypto.randomUUID();
  const signature = await signSessionId(unsignedSessionId, env);
  return packSessionId({ unsignedSessionId, signature });
}

export const isValidSessionId = async (sessionId: string, env: Env) => {
  const { unsignedSessionId, signature } = unpackSessionId(sessionId);
  const computedSignature = await signSessionId(unsignedSessionId, env);
  return computedSignature === signature;
}

export const getSession = async (request: Request, env: Env) => {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    throw new ErrorResponse(401, "No cookie found");
  }

  // Parse the session_id from cookies properly
  const sessionId = cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('session_id='))
    ?.split('=')[1];

  if (!sessionId) {
    throw new ErrorResponse(401, "No session id found");
  }

  if (!await isValidSessionId(sessionId, env)) {
    throw new ErrorResponse(401, "Invalid session id");
  }

  const doId = env.SESSION_DO.idFromName(sessionId);
  const sessionDO = env.SESSION_DO.get(doId) as DurableObjectStub<SessionDO>;
  const session = await sessionDO.getSession();

  if ('error' in session) {
    throw new ErrorResponse(401, session.error);
  }

  return session.value;
}
