// context(justinvdm, 24 Mar 2025): React flight limits chunks to 28 bytes, so we need to rechunk
// the stream to avoid losing data
function rechunkStream(
  stream: ReadableStream,
  maxChunkSize: number = 28,
): ReadableStream {
  const reader = stream.getReader();
  return new ReadableStream({
    async pull(controller) {
      let buffer = new Uint8Array(0);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done && buffer.length === 0) {
            controller.close();
            return;
          }

          if (value) {
            buffer = new Uint8Array([...buffer, ...value]);
          }

          while (buffer.length >= maxChunkSize || (done && buffer.length > 0)) {
            const chunk = buffer.slice(0, maxChunkSize);
            buffer = buffer.slice(maxChunkSize);
            controller.enqueue(chunk);
          }

          if (done) {
            controller.close();
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Checks if a status code indicates a redirect response.
 */
function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export const normalizeActionResult = (actionResult: any) => {
  if (actionResult instanceof Response) {
    const status = actionResult.status;
    const location = actionResult.headers.get("Location");

    // Convert redirect responses to a serializable format
    if (isRedirectStatus(status) && location) {
      return {
        __rwsdk_response: {
          type: "redirect" as const,
          url: location,
          status,
        },
      };
    }

    // For other Response types, return a generic format
    return {
      __rwsdk_response: {
        type: "other" as const,
        status,
        statusText: actionResult.statusText,
      },
    };
  }

  if (actionResult instanceof ReadableStream) {
    return rechunkStream(actionResult);
  }

  return actionResult;
};
