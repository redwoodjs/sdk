export const validateUpgradeRequest = (
  request: Request,
): { valid: false; response: Response } | { valid: true } => {
  if (request.headers.get("Upgrade") !== "websocket") {
    return {
      valid: false,
      response: new Response("Expected WebSocket", { status: 400 }),
    };
  }

  const requestOrigin = request.headers.get("Origin");

  if (!requestOrigin) {
    return {
      valid: false,
      response: new Response("Invalid origin", { status: 403 }),
    };
  }

  const requestOriginUrl = new URL(requestOrigin);
  const url = new URL(request.url);

  if (requestOriginUrl.origin === url.origin) {
    return {
      valid: true,
    };
  }

  return {
    valid: false,
    response: new Response("Invalid origin", { status: 403 }),
  };
};
