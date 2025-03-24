"use client";

import { sendMessage } from "./functions";
import { useMemo, useRef, useState } from "react";

interface UseStreamOptions {
  decode?: boolean;
}

export function useStream(options: UseStreamOptions = {}) {
  const { decode = true } = options;
  const [chunks, setChunks] = useState<string[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

  const stream = useMemo(() => {
    const decoder = new TextDecoder();
    const { readable, writable } = new TransformStream();

    const reader = readable.getReader();
    readerRef.current = reader;

    (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text =
          decode && value instanceof Uint8Array
            ? decoder.decode(value, { stream: true })
            : (value as string);

        setChunks((prev) => [...prev, text]);
      }
    })();

    return { readable, writable };
  }, []);

  return { stream, chunks };
}

function parseWorkersAIChunk(chunk: string): string {
  try {
    const match = chunk.match(/"response":"([^"]*?)"/);
    return match ? match[1] : "";
  } catch (e) {
    return "";
  }
}

export function ChatBar() {
  const [message, setMessage] = useState("");
  const { stream, chunks } = useStream();

  const onClick = async () => {
    (await sendMessage(message)).pipeTo(stream.writable);
  };

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={onClick}>Send</button>
      <div>{chunks.map(parseWorkersAIChunk).join("")}</div>
    </div>
  );
}
