/**
 * A TransformStream that processes an input stream and performs two types of replacements:
 * 1. String replacements (e.g., inject content before a closing tag)
 * 2. Stream injections (e.g., replace a placeholder with content from another stream)
 */
export class StreamStitcher extends TransformStream<Uint8Array, Uint8Array> {
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  constructor(
    private replacements: {
      stringReplacements: Array<{
        search: string;
        replace: string | (() => Promise<string>);
      }>;
      streamReplacements: Array<{
        placeholder: string;
        stream: ReadableStream<Uint8Array>;
      }>;
    },
  ) {
    super({
      transform: async (chunk, controller) => {
        const chunkAsString = this.textDecoder.decode(chunk);

        // Check for string replacements
        for (const { search, replace } of this.replacements
          .stringReplacements) {
          if (chunkAsString.includes(search)) {
            const replacement =
              typeof replace === "function" ? await replace() : replace;
            const modifiedChunk = chunkAsString.replace(search, replacement);
            controller.enqueue(this.textEncoder.encode(modifiedChunk));
            return;
          }
        }

        // Check for stream replacements
        for (const { placeholder, stream } of this.replacements
          .streamReplacements) {
          if (chunkAsString.includes(placeholder)) {
            const parts = chunkAsString.split(placeholder);

            // Enqueue content before placeholder
            if (parts[0]) {
              controller.enqueue(this.textEncoder.encode(parts[0]));
            }

            // Inject the replacement stream
            const reader = stream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
            }

            // Enqueue content after placeholder
            if (parts[1]) {
              controller.enqueue(this.textEncoder.encode(parts[1]));
            }
            return;
          }
        }

        // No replacements found, pass through unchanged
        controller.enqueue(chunk);
      },
    });
  }
}
