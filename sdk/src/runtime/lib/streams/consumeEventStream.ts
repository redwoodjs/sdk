import {
  EventSourceParserStream,
  type EventSourceMessage,
} from "eventsource-parser/stream";

export function consumeEventStream({
  onChunk,
}: {
  onChunk: (chunk: EventSourceMessage) => void;
}): WritableStream<Uint8Array> {
  const stream = new TransformStream();

  stream.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .pipeTo(
      new WritableStream({
        write(chunk) {
          onChunk(chunk);
        },
      }),
    );

  return stream.writable;
}
