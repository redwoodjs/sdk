import { ReactElement } from "react";
import { type RenderToStreamOptions, renderToStream } from "./renderToStream";

export type RenderToStringOptions = Omit<RenderToStreamOptions, "onError">;

export const renderToString = async (
  element: ReactElement,
  options?: RenderToStringOptions,
): Promise<string> => {
  const stream = await new Promise<ReadableStream>((resolve, reject) =>
    renderToStream(element, {
      ...options,
      onError: reject,
    })
      .then(resolve)
      .catch(reject),
  );

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    // Flush any remaining bytes
    result += decoder.decode();
    return result;
  } finally {
    reader.releaseLock();
  }
};
