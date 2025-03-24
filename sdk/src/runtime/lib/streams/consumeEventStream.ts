import {
  EventSourceParserStream,
  type EventSourceMessage,
} from "eventsource-parser/stream";

export function consumeEventStream({
  onChunk,
}: {
  onChunk: (chunk: EventSourceMessage) => void;
}): WritableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";

  // Step 1: Decode bytes -> strings
  const decodeText = new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      controller.enqueue(buffer);
      buffer = "";
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer) controller.enqueue(buffer);
    },
  });

  // Step 2: Split on '\n\n' boundaries (SSE message separator)
  const splitOnDoubleNewline = new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;

      console.log("####### buffer", buffer);
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const full = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 2); // remove '\n\n'
        if (full) controller.enqueue(full);
      }
    },
    flush(controller) {
      if (buffer.trim()) controller.enqueue(buffer.trim());
    },
  });

  // Step 3: Parse SSE lines into EventSourceMessage
  const parseSSE = new EventSourceParserStream();

  const stream = new TransformStream();

  stream.readable
    .pipeThrough(decodeText)
    .pipeThrough(splitOnDoubleNewline)
    .pipeThrough(parseSSE)
    .pipeTo(
      new WritableStream({
        write(chunk) {
          onChunk(chunk);
        },
      }),
    );

  return stream.writable;
}
