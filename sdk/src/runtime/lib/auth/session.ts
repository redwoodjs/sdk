import { ErrorResponse } from "../../error";

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
  sessionId,
  maxAge,
}: {
  sessionId: string;
  maxAge?: number | true;
}) => {
  const isViteDev =
    typeof import.meta.env !== "undefined" && import.meta.env.DEV;

  return `session_id=${sessionId}; Path=/; HttpOnly; ${isViteDev ? "" : "Secure; "}SameSite=Lax${
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
  const { unsignedSessionId, signature } = unpackSessionId(sessionId);
  const computedSignature = await signSessionId({
    unsignedSessionId,
    secretKey,
  });
  return computedSignature === signature;
};

export const defineSessionStore = <Session, SessionInputData>({
  cookieName = "session_id",
  secretKey,
  get,
  set,
  unset,
}: {
  cookieName?: string;
  secretKey: string;
  get: (sessionId: string) => Promise<Session>;
  set: (sessionId: string, sessionInputData: SessionInputData) => Promise<void>;
  unset: (sessionId: string) => Promise<void>;
}) => {
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
    headers: Headers,
    sessionInputData: SessionInputData,
    { maxAge }: { maxAge?: number | true } = {},
  ): Promise<void> => {
    const sessionId = await generateSessionId({ secretKey });
    await set(sessionId, sessionInputData);
    headers.set("Set-Cookie", createSessionCookie({ sessionId, maxAge }));
  };

  const remove = async (request: Request, headers: Headers): Promise<void> => {
    const sessionId = getSessionIdFromCookie(request);
    if (sessionId) {
      await unset(sessionId);
    }
    headers.set(
      "Set-Cookie",
      createSessionCookie({ sessionId: "", maxAge: 0 }),
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
  secretKey,
  sessionDurableObject,
}: {
  cookieName?: string;
  secretKey: string;
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
    const { unsignedSessionId } = unpackSessionId(sessionId);
    const doId = sessionDurableObject.idFromName(unsignedSessionId);
    const sessionStub = sessionDurableObject.get(doId);
    await sessionStub.revokeSession();
  };

  return defineSessionStore({
    cookieName,
    secretKey,
    get,
    set,
    unset,
  }) as SessionStoreFromDurableObject<SessionDurableObject>;
};
