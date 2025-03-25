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

  // Combined decoding and split on '\n\n' boundaries
  const decodeAndSplit = new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      console.log("buffer", buffer);
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const full = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 2); // remove '\n\n'
        if (full) controller.enqueue(full);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) controller.enqueue(buffer.trim());
    },
  });

  const parseSSE = new EventSourceParserStream();

  const stream = new TransformStream();

  stream.readable
    .pipeThrough(decodeAndSplit)
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
