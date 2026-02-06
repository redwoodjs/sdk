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

export const normalizeActionResult = (actionResult: any) => {
  if (actionResult instanceof Response) {
    const headers = Object.fromEntries(
      actionResult.headers.entries(),
    ) as Record<string, string | null>;
    headers.location = actionResult.headers.get("location");

    return {
      __rw_action_response: {
        status: actionResult.status,
        statusText: actionResult.statusText,
        headers,
      },
    };
  }

  if (actionResult instanceof ReadableStream) {
    return rechunkStream(actionResult);
  }

  return actionResult;
};
