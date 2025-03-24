import { useEffect, useState } from "react';

interface UseStreamOptions {
  decode?: boolean;
  cancelOnUnmount?: boolean;
}

export function useStream(
  stream: ReadableStream<Uint8Array | string> | undefined,
  options: UseStreamOptions = {}
): string[] {
  const { decode = true, cancelOnUnmount = true } = options;
  const [chunks, setChunks] = useState<string[]>([]);

  useEffect(() => {
    if (!stream) return;

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let isCancelled = false;

    async function read() {
      while (!isCancelled) {
        const { done, value } = await reader.read();
        if (done || isCancelled) break;

        let chunk: string;
        if (decode && value instanceof Uint8Array) {
          chunk = decoder.decode(value, { stream: true });
        } else {
          chunk = value as string;
        }

        setChunks((prev) => [...prev, chunk]);
      }
    }

    read();

    return () => {
      if (cancelOnUnmount) {
        isCancelled = true;
        reader.cancel().catch(() => {});
      }
    };
  }, [stream, decode, cancelOnUnmount]);

  return chunks;
}