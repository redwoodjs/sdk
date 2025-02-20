import { ErrorResponse } from "../../error";

const MAX_TOKEN_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days

type GetSessionResult<Session> = { value: Session } | { error: string };

export interface DurableObjectMethods<Session> extends Rpc.DurableObjectBranded {
  getSession(): Promise<GetSessionResult<Session>>;
  saveSession(data: any): Promise<Session>;
  revokeSession(): void;
}

interface SessionIdParts {
  unsignedSessionId: string;
  signature: string;
}

export type SessionStore<Session> = ReturnType<typeof defineSessionStore<Session>>;

const packSessionId = (parts: SessionIdParts): string => {
  return btoa([parts.unsignedSessionId, parts.signature].join(':'));
}

const unpackSessionId = (packed: string): SessionIdParts => {
  const [unsignedSessionId, signature] = atob(packed).split(':');
  return { unsignedSessionId, signature };
}

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const array = new Uint8Array(buffer);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const createSessionCookie = ({ sessionId, maxAge }: { sessionId: string, maxAge?: number | true }) =>
  `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax${maxAge ? `; Max-Age=${maxAge === true ? MAX_TOKEN_DURATION / 1000 : maxAge}` : ''}`;

export const signSessionId = async ({ unsignedSessionId, secretKey }: { unsignedSessionId: string, secretKey: string }) => {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureArrayBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(unsignedSessionId)
  );

  return arrayBufferToHex(signatureArrayBuffer);
}

export const generateSessionId = async ({ secretKey }: { secretKey: string }) => {
  const unsignedSessionId = crypto.randomUUID();
  const signature = await signSessionId({ unsignedSessionId, secretKey });
  return packSessionId({ unsignedSessionId, signature });
}

export const isValidSessionId = async ({ sessionId, secretKey }: { sessionId: string, secretKey: string }) => {
  const { unsignedSessionId, signature } = unpackSessionId(sessionId);
  const computedSignature = await signSessionId({ unsignedSessionId, secretKey });
  return computedSignature === signature;
}

export const defineSessionStore = <Session>({
  cookieName = 'session_id',
  secretKey,
  get,
  set,
  unset,
}: {
  cookieName?: string,
  secretKey: string,
  get(input: { sessionId: string }): Promise<Session>,
  set(input: { sessionId: string, session: Session, maxAge?: number | true }): Promise<void>,
  unset(input: { sessionId: string }): Promise<void>
}) => {
  const getSessionIdFromCookie = ({ request }: { request: Request }): string | undefined => {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return undefined;

    for (const cookie of cookieHeader.split(';')) {
      const [key, value] = cookie.trim().split('=');
      if (key === cookieName) {
        return value;
      }
    }
  };

  const load = async ({ request }: { request: Request }): Promise<Session> => {
    const sessionId = getSessionIdFromCookie({ request });
    if (!sessionId) {
      throw new ErrorResponse(401, "No session id found");
    }

    if (!await isValidSessionId({ sessionId, secretKey })) {
      throw new ErrorResponse(401, "Invalid session id");
    }

    try {
      return await get({ sessionId });
    } catch (error) {
      throw new ErrorResponse(401, "Invalid session id");
    }
  };

  const save = async (
    { response, session, maxAge }: { response: Response, session: Session, maxAge?: number | true }
  ): Promise<Response> => {
    const sessionId = await generateSessionId({ secretKey });
    await set({ sessionId, session, maxAge });
    const newResponse = response.clone();
    newResponse.headers.set("Set-Cookie", createSessionCookie({ sessionId, maxAge }));
    return newResponse;
  };

  const remove = async (
    { request, response }: { request: Request, response: Response }
  ): Promise<Response> => {
    const sessionId = getSessionIdFromCookie({ request });
    if (sessionId) {
      await unset({ sessionId });
    }
    const newResponse = response.clone();
    newResponse.headers.set("Set-Cookie", createSessionCookie({ sessionId: '', maxAge: 0 }));
    return newResponse;
  };

  return {
    load,
    save,
    remove,
  };
};

export const defineDurableSession = <Session, SessionDurableObject extends DurableObjectMethods<Session>>({
  cookieName,
  secretKey,
  sessionDurableObject,
}: {
  cookieName?: string,
  secretKey: string,
  sessionDurableObject: DurableObjectNamespace<SessionDurableObject>
}) => {
  const get = async ({ sessionId }: { sessionId: string }): Promise<Session> => {
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    const result = await sessionStub.getSession() as GetSessionResult<Session>;
    
    if ('error' in result) {
      throw new Error(result.error);
    }
    
    return result.value;
  };

  const set = async ({ sessionId, session, maxAge }: { sessionId: string, session: Session, maxAge?: number | true }): Promise<void> => {
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    await sessionStub.saveSession(session);
  };

  const unset = async ({ sessionId }: { sessionId: string }): Promise<void> => {
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    await sessionStub.revokeSession();
  };

  return defineSessionStore({ cookieName, secretKey, get, set, unset });
};