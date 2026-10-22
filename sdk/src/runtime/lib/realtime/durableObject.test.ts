import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }));

import { RealtimeDurableObject } from "./durableObject";
import { packMessage, unpackMessage } from "./protocol";
import { MESSAGE_TYPE } from "./shared";

const origin = "https://app.example";
const requestId = "11111111-1111-1111-1111-111111111111";
const invalidUrls = [
  "https://other.example/page",
  "http://app.example/page",
  "https://app.example:8443/page",
  "https://app.example.other.example/page",
  "//other.example/page",
  "not a URL",
];

function setup() {
  const info = {
    origin,
    url: `${origin}/page`,
    clientId: "client",
    cookieHeaders: "session=fixture",
    shouldForwardResponses: true,
  };
  const storage = {
    get: vi.fn(async () => info),
    put: vi.fn(async () => {}),
  };
  const getWebSockets = vi.fn(() => [] as WebSocket[]);
  const instance = new RealtimeDurableObject(
    { storage, getWebSockets } as unknown as DurableObjectState,
    {} as Env,
  );
  instance.clientInfoCache.set(info.clientId, info);
  const socket = {
    deserializeAttachment: () => info.clientId,
    send: vi.fn(),
  } as unknown as WebSocket;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const action = (clientUrl: string) =>
    instance.webSocketMessage(
      socket,
      packMessage({
        type: MESSAGE_TYPE.ACTION_REQUEST,
        id: null,
        args: "fixture-body",
        requestId,
        clientUrl,
      }).buffer as ArrayBuffer,
    );
  return { instance, info, storage, socket, fetcher, action, getWebSockets };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("realtime destinations", () => {
  it.each(invalidUrls)(
    "rejects initial URL %s before upgrading",
    async (url) => {
      const { instance, fetcher } = setup();
      const request = new Request(
        `${origin}/__realtime?url=${encodeURIComponent(url)}`,
        { headers: { Upgrade: "websocket", Origin: origin } },
      );
      expect((await instance.fetch(request)).status).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("records the application origin independently of the client URL", async () => {
    const { instance } = setup();
    const upgrade = vi
      .spyOn(instance as any, "handleWebSocket")
      .mockResolvedValue(new Response());
    const request = new Request(
      `${origin}/__realtime?url=${encodeURIComponent(`${origin}/page`)}`,
      { headers: { Upgrade: "websocket", Origin: origin } },
    );
    await instance.fetch(request);
    expect(upgrade).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ origin, url: `${origin}/page` }),
    );
  });

  it.each(invalidUrls)(
    "rejects action URL %s without changing stored state",
    async (url) => {
      const { instance, info, storage, socket, fetcher, action } = setup();
      await action(url);
      expect(fetcher).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
      expect(instance.clientInfoCache.get(info.clientId)?.url).toBe(
        `${origin}/page`,
      );
      const frame = vi.mocked(socket.send).mock.calls[0][0] as Uint8Array;
      expect(unpackMessage(frame)).toMatchObject({
        type: MESSAGE_TYPE.ACTION_ERROR,
        id: requestId,
      });
    },
  );

  it.each([false, true])(
    "preserves same origin actions with cached state %s",
    async (cached) => {
      const { instance, info, storage, socket, fetcher, action } = setup();
      if (!cached) instance.clientInfoCache.clear();
      fetcher.mockResolvedValue(new Response("action-result"));
      await action(`${origin}/next?value=1`);
      expect(fetcher).toHaveBeenCalledWith(
        `${origin}/next?value=1&__rsc=`,
        expect.objectContaining({
          method: "POST",
          redirect: "manual",
          body: "fixture-body",
          headers: {
            "Content-Type": "application/json",
            Cookie: info.cookieHeaders,
          },
        }),
      );
      expect(storage.put).toHaveBeenCalledWith(
        "client:client",
        expect.objectContaining({ origin, url: `${origin}/next?value=1` }),
      );
      expect(
        vi
          .mocked(socket.send)
          .mock.calls.map(([frame]) => unpackMessage(frame as Uint8Array).type),
      ).toEqual([
        MESSAGE_TYPE.ACTION_START,
        MESSAGE_TYPE.ACTION_CHUNK,
        MESSAGE_TYPE.ACTION_END,
      ]);
    },
  );

  it("returns action redirects without following them", async () => {
    const { socket, fetcher, action } = setup();
    fetcher.mockResolvedValue(
      new Response("redirect", {
        status: 302,
        headers: { Location: "https://other.example/page" },
      }),
    );
    await action(`${origin}/redirect`);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
    const frame = vi.mocked(socket.send).mock.calls[0][0] as Uint8Array;
    expect(unpackMessage(frame)).toMatchObject({
      type: MESSAGE_TYPE.ACTION_START,
      status: 302,
    });
  });

  it.each(["foreign", "legacy"])(
    "does not render %s stored destinations",
    async (kind) => {
      const { instance, info, socket, fetcher, getWebSockets } = setup();
      vi.spyOn(console, "error").mockImplementation(() => {});
      if (kind === "foreign") info.url = "https://other.example/page";
      else Reflect.deleteProperty(info, "origin");
      getWebSockets.mockReturnValue([socket]);
      await instance.render();
      expect(fetcher).not.toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
    },
  );

  it("requires legacy clients to reconnect before sending actions", async () => {
    const { info, fetcher, action } = setup();
    Reflect.deleteProperty(info, "origin");
    await action(`${origin}/page`);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves same origin rendering without following redirects", async () => {
    const { instance, info, socket, fetcher, getWebSockets } = setup();
    getWebSockets.mockReturnValue([socket]);
    fetcher.mockResolvedValue(new Response("render-result"));
    await instance.render();
    expect(fetcher).toHaveBeenCalledWith(`${origin}/page?__rsc=true`, {
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Cookie: info.cookieHeaders,
      },
    });
    expect(
      vi
        .mocked(socket.send)
        .mock.calls.map(([frame]) => unpackMessage(frame as Uint8Array).type),
    ).toEqual([
      MESSAGE_TYPE.RSC_START,
      MESSAGE_TYPE.RSC_CHUNK,
      MESSAGE_TYPE.RSC_END,
    ]);
  });
});
