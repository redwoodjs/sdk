import { env } from "cloudflare:workers";
import { ErrorResponse } from "../../error";

const AUTH_SECRET_KEY =
  (env as { AUTH_SECRET_KEY?: string }).AUTH_SECRET_KEY ??
  (import.meta.env.VITE_IS_DEV_SERVER
    ? "development-secret-key-do-not-use-in-production"
    : undefined);

if (AUTH_SECRET_KEY === "") {
  console.warn(
    "AUTH_SECRET_KEY is set but empty. Please provide a non-empty secret key for session store security.",
  );
}

if (!AUTH_SECRET_KEY) {
  console.warn(
    "AUTH_SECRET_KEY not set. Please set this environment variable to a secure random key for session store security.",
  );
}

export const MAX_SESSION_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days

type GetSessionResult<Session> = { value: Session } | { error: string };

export interface DurableObjectMethods<Session, SessionInputData>
  extends Rpc.DurableObjectBranded {
  getSession(): Promise<GetSessionResult<Session>>;
  saveSession(data: SessionInputData): Promise<Session>;
  revokeSession(): void;
}

interface SessionIdParts {
  unsignedSessionId: string;
  signature: string;
}

export type SessionStore<Session, SessionInputData = Session> = ReturnType<
  typeof defineSessionStore<Session, SessionInputData>
>;

const packSessionId = (parts: SessionIdParts): string => {
  return btoa([parts.unsignedSessionId, parts.signature].join(":"));
};

const unpackSessionId = (packed: string): SessionIdParts => {
  const [unsignedSessionId, signature] = atob(packed).split(":");
  return { unsignedSessionId, signature };
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const array = new Uint8Array(buffer);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const createSessionCookie = ({
  name,
  sessionId,
  maxAge,
}: {
  name: string;
  sessionId: string;
  maxAge?: number | true;
}) => {
  const isViteDev =
    typeof import.meta.env !== "undefined" && import.meta.env.DEV;

  return `${name}=${sessionId}; Path=/; HttpOnly; ${
    isViteDev ? "" : "Secure; "
  }SameSite=Lax${
    maxAge != null
      ? `; Max-Age=${maxAge === true ? MAX_SESSION_DURATION / 1000 : maxAge}`
      : ""
  }`;
};

export const signSessionId = async ({
  unsignedSessionId,
  secretKey,
}: {
  unsignedSessionId: string;
  secretKey: string;
}) => {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureArrayBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(unsignedSessionId),
  );

  return arrayBufferToHex(signatureArrayBuffer);
};

export const generateSessionId = async ({
  secretKey,
}: {
  secretKey: string;
}) => {
  const unsignedSessionId = crypto.randomUUID();
  const signature = await signSessionId({ unsignedSessionId, secretKey });
  return packSessionId({ unsignedSessionId, signature });
};

export const isValidSessionId = async ({
  sessionId,
  secretKey,
}: {
  sessionId: string;
  secretKey: string;
}) => {
  try {
    const { unsignedSessionId, signature } = unpackSessionId(sessionId);
    const computedSignature = await signSessionId({
      unsignedSessionId,
      secretKey,
    });
    return computedSignature === signature;
  } catch {
    return false;
  }
};

export const defineSessionStore = <Session, SessionInputData>({
  cookieName = "session_id",
  createCookie = createSessionCookie,
  secretKey = AUTH_SECRET_KEY,
  get,
  set,
  unset,
}: {
  cookieName?: string;
  createCookie?: typeof createSessionCookie;
  secretKey?: string;
  get: (sessionId: string) => Promise<Session>;
  set: (sessionId: string, sessionInputData: SessionInputData) => Promise<void>;
  unset: (sessionId: string) => Promise<void>;
}) => {
  if (!secretKey) {
    throw new Error("No secret key provided for session store");
  }

  const getSessionIdFromCookie = (request: Request): string | undefined => {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return undefined;

    for (const cookie of cookieHeader.split(";")) {
      const trimmedCookie = cookie.trim();
      const separatorIndex = trimmedCookie.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmedCookie.slice(0, separatorIndex);
      const value = trimmedCookie.slice(separatorIndex + 1);

      if (key === cookieName) {
        return value;
      }
    }
  };

  const load = async (request: Request): Promise<Session | null> => {
    const sessionId = getSessionIdFromCookie(request);

    if (!sessionId) {
      return null;
    }

    if (!(await isValidSessionId({ sessionId, secretKey }))) {
      throw new ErrorResponse(401, "Invalid session id");
    }

    try {
      return await get(sessionId);
    } catch (error) {
      throw new ErrorResponse(401, "Invalid session id");
    }
  };

  const save = async (
    responseHeaders: Headers,
    sessionInputData: SessionInputData,
    { maxAge }: { maxAge?: number | true } = {},
  ): Promise<void> => {
    const sessionId = await generateSessionId({ secretKey });
    await set(sessionId, sessionInputData);
    responseHeaders.set(
      "Set-Cookie",
      createCookie({ name: cookieName, sessionId, maxAge }),
    );
  };

  const remove = async (
    request: Request,
    responseHeaders: Headers,
  ): Promise<void> => {
    const sessionId = getSessionIdFromCookie(request);
    if (sessionId) {
      await unset(sessionId);
    }
    responseHeaders.set(
      "Set-Cookie",
      createCookie({ name: cookieName, sessionId: "", maxAge: 0 }),
    );
  };

  return {
    load,
    save,
    remove,
  };
};

type SessionStoreFromDurableObject<SessionDurableObject> =
  SessionDurableObject extends DurableObjectMethods<
    infer Session,
    infer SessionInputData
  >
    ? SessionStore<Session, SessionInputData>
    : never;
type SessionInputDataFromDurableObject<SessionDurableObject> =
  SessionDurableObject extends DurableObjectMethods<any, infer SessionInputData>
    ? SessionInputData
    : never;
type SessionFromDurableObject<SessionDurableObject> =
  SessionDurableObject extends DurableObjectMethods<any, infer SessionInputData>
    ? SessionInputData
    : never;

export const defineDurableSession = <
  SessionDurableObject extends DurableObjectMethods<any, any>,
>({
  cookieName,
  createCookie,
  secretKey = AUTH_SECRET_KEY,
  sessionDurableObject,
}: {
  cookieName?: string;
  createCookie?: typeof createSessionCookie;
  secretKey?: string;
  sessionDurableObject: DurableObjectNamespace<SessionDurableObject>;
}): SessionStoreFromDurableObject<SessionDurableObject> => {
  type Session = SessionFromDurableObject<SessionDurableObject>;
  type SessionInputData =
    SessionInputDataFromDurableObject<SessionDurableObject>;

  const get = async (sessionId: string): Promise<Session> => {
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    const result =
      (await sessionStub.getSession()) as GetSessionResult<Session>;

    if ("error" in result) {
      throw new Error(result.error);
    }

    return result.value;
  };

  const set = async (
    sessionId: string,
    sessionInputData: SessionInputData,
  ): Promise<void> => {
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    // todo(justinvdm, 2025-02-20): Fix this
    // @ts-ignore
    await sessionStub.saveSession(sessionInputData as any);
  };

  const unset = async (sessionId: string): Promise<void> => {
    let unsignedSessionId: string;

    try {
      unsignedSessionId = unpackSessionId(sessionId).unsignedSessionId;
    } catch {
      return;
    }

    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    await sessionStub.revokeSession();
  };

  return defineSessionStore({
    cookieName,
    createCookie,
    secretKey,
    get,
    set,
    unset,
  }) as SessionStoreFromDurableObject<SessionDurableObject>;
};
