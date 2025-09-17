/**
 * A WritableStream that buffers an input stream of HTML content until it finds the
 * closing `</head>` tag. It resolves a promise (`this.preamble`) with the
 * content found between `<head>` and `</head>`, and then closes itself without
 * passing any data through.
 *
 * This is designed to be used on a `tee()`-d stream; its only purpose is to
 * extract the preamble for use in another stream. The stream should be fully
 * consumed via `pipeTo(preambleExtractor.writable)`.
 */
export class PreambleExtractor extends WritableStream<Uint8Array> {
  #buffer: Uint8Array = new Uint8Array();
  readonly #decoder = new TextDecoder();
  readonly #preamblePromise: Promise<string>;
  #preambleResolver!: (preamble: string) => void;
  #found = false;

  constructor() {
    super({
      write: (chunk: Uint8Array) => {
        if (this.#found) {
          return;
        }
        this.#buffer = new Uint8Array([...this.#buffer, ...chunk]);
        // Use the stream decoder to handle multi-byte characters correctly
        const bufferAsString = this.#decoder.decode(this.#buffer, {
          stream: true,
        });
        const sentinelIndex = bufferAsString.indexOf("</head>");

        if (sentinelIndex !== -1) {
          this.#found = true;
          const headContent = bufferAsString.substring(0, sentinelIndex);
          const preamble = headContent.match(/<head>(.*)/s)?.[1] ?? "";
          this.#preambleResolver(preamble);
        }
      },
      close: () => {
        if (!this.#found) {
          // If the stream ends before we find the sentinel, resolve with empty
          this.#preambleResolver("");
        }
      },
    });

    this.#preamblePromise = new Promise((resolve) => {
      this.#preambleResolver = resolve;
    });
  }

  get preamble(): Promise<string> {
    return this.#preamblePromise;
  }
}

type BodyContentExtractorState = "before-body" | "in-body" | "after-body";

/**
 * A TransformStream that processes an input stream of HTML content and only
 * passes through the content found between the `<body>` and `</body>` tags.
 * It discards the tags themselves and everything outside of them.
 */
export class BodyContentExtractor extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  #state: BodyContentExtractorState = "before-body";
  #buffer: Uint8Array = new Uint8Array();
  readonly #decoder = new TextDecoder();
  readonly #encoder = new TextEncoder();

  constructor() {
    super({
      transform: (
        chunk: Uint8Array,
        controller: TransformStreamDefaultController<Uint8Array>,
      ) => {
        if (this.#state === "after-body") {
          return; // Discard everything after the body
        }

        this.#buffer = new Uint8Array([...this.#buffer, ...chunk]);
        let bufferAsString = this.#decoder.decode(this.#buffer, {
          stream: true,
        });

        if (this.#state === "before-body") {
          const bodyStartMatch = bufferAsString.match(/<body[^>]*>/);
          if (bodyStartMatch) {
            this.#state = "in-body";
            const bodyStartIndex = bodyStartMatch.index!;
            const bodyTagLength = bodyStartMatch[0].length;
            // Start of body is in this chunk, discard everything before it
            bufferAsString = bufferAsString.substring(
              bodyStartIndex + bodyTagLength,
            );
          } else {
            // Body not found yet, keep buffering
            return;
          }
        }

        if (this.#state === "in-body") {
          const bodyEndIndex = bufferAsString.indexOf("</body>");
          if (bodyEndIndex !== -1) {
            this.#state = "after-body";
            // End of body is in this chunk, enqueue everything before it
            const content = bufferAsString.substring(0, bodyEndIndex);
            controller.enqueue(this.#encoder.encode(content));
            // Close the stream as we are done
            controller.terminate();
          } else {
            // End of body not found, enqueue the whole processed chunk
            controller.enqueue(this.#encoder.encode(bufferAsString));
            // Reset buffer since we've processed it
            this.#buffer = new Uint8Array();
          }
        }
      },
      flush: (controller: TransformStreamDefaultController<Uint8Array>) => {
        // If the stream ends while we are still in the body, flush any remaining buffer
        if (this.#state === "in-body" && this.#buffer.length > 0) {
          const bufferAsString = this.#decoder.decode(this.#buffer);
          const bodyEndIndex = bufferAsString.indexOf("</body>");
          if (bodyEndIndex !== -1) {
            const content = bufferAsString.substring(0, bodyEndIndex);
            controller.enqueue(this.#encoder.encode(content));
          } else {
            controller.enqueue(this.#buffer);
          }
        }
      },
    });
  }
}
