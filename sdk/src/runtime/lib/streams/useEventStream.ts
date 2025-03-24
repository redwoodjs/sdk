"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  EventSourceParserStream,
  type EventSourceMessage,
} from "eventsource-parser/stream";

interface UseEventStreamOptions {
  onEvent: (event: EventSourceMessage) => void;
  onError?: (error: unknown) => void;
}

export function useEventStream(options: UseEventStreamOptions) {
  const { onEvent, onError = console.error } = options;
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  const createStream = useCallback(() => {
    const { readable, writable } = new TransformStream();

    readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeTo(
        new WritableStream({
          write(chunk) {
            onEventRef.current(chunk);
          },
          abort(reason) {
            onErrorRef.current(reason);
          },
        }),
      )
      .catch(onErrorRef.current);

    return writable;
  }, []);

  return createStream;
}
