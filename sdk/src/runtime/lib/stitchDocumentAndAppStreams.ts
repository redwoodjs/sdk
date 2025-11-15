/**
 * A utility to orchestrate and interleave two ReadableStreams (a document shell and an app shell)
 * based on a set of markers within their content. This is designed to solve a specific
 * race condition in streaming Server-Side Rendering (SSR) with Suspense.
 *
 * The logic is as follows:
 * 1. **Hoisting Phase**: Read from the app stream first to capture any hoisted tags (`<title>`, `<meta>`, etc.).
 * 2. Stream the document until a start marker is found.
 * 3. Switch to the app stream (with hoisted tags removed) and stream it until an end marker is found.
 * 4. Switch back to the document stream and stream it until the closing body tag.
 * 5. Switch back to the app stream and stream the remainder (the suspended content).
 * 6. Switch back to the document stream and stream the remainder (closing body and html tags).
 *
 * @param outerHtml The stream for the document shell (`<Document>`).
 * @param innerHtml The stream for the application's content.
 * @param startMarker The marker in the document to start injecting the app.
 * @param endMarker The marker in the app stream that signals the end of the initial, non-suspended render.
 */
export function stitchDocumentAndAppStreams(
  outerHtml: ReadableStream<Uint8Array>,
  innerHtml: ReadableStream<Uint8Array>,
  startMarker: string,
  endMarker: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let outerReader: ReadableStreamDefaultReader<Uint8Array>;
  let innerReader: ReadableStreamDefaultReader<Uint8Array>;

  let buffer = "";
  let outerBufferRemains = "";
  let phase:
    | "hoist-meta"
    | "outer-head"
    | "inner-shell"
    | "outer-tail"
    | "inner-suspended"
    | "outer-end" = "hoist-meta";

  // This regex is designed to be non-greedy and match hoistable tags
  // that appear at the very beginning of the stream.
  const hoistableTagRegex = /^(<title>.*?<\/title>|<meta[^>]*>|<link[^>]*>)+/;

  const pump = async (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> => {
    try {
      if (phase === "hoist-meta") {
        const { done, value } = await innerReader.read();

        if (done) {
          // The app stream is finished. What we have in the buffer is all there is.
          const match = buffer.match(hoistableTagRegex);
          if (match) {
            controller.enqueue(encoder.encode(match[0]));
            buffer = buffer.slice(match[0].length);
          }
          phase = "outer-head";
        } else {
          buffer += decoder.decode(value, { stream: true });
          // If the buffer does not start with a '<', it's not a tag, so hoisting is done.
          if (!buffer.startsWith("<")) {
            phase = "outer-head";
          } else {
            const match = buffer.match(hoistableTagRegex);
            if (!match) {
              // No match, means we've hit non-hoistable content.
              phase = "outer-head";
            } else if (match[0].length < buffer.length) {
              // We had a match, but there's more in the buffer.
              // This means we've found all hoistable tags.
              controller.enqueue(encoder.encode(match[0]));
              buffer = buffer.slice(match[0].length);
              phase = "outer-head";
            }
            // If the entire buffer is a match, we continue to the next chunk.
          }
        }

        if (phase === "hoist-meta") {
          return pump(controller);
        }
      }

      if (phase === "outer-head") {
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) controller.enqueue(encoder.encode(buffer));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const markerIndex = buffer.indexOf(startMarker);
        if (markerIndex !== -1) {
          controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
          outerBufferRemains = buffer.slice(markerIndex + startMarker.length);
          buffer = ""; // Clear buffer for the next phase
          phase = "inner-shell";
        } else {
          const flushIndex = buffer.lastIndexOf("\n");
          if (flushIndex !== -1) {
            controller.enqueue(encoder.encode(buffer.slice(0, flushIndex + 1)));
            buffer = buffer.slice(flushIndex + 1);
          }
        }
      } else if (phase === "inner-shell") {
        // We might have leftover from the hoist-meta phase
        if (buffer) {
          const markerIndex = buffer.indexOf(endMarker);
          if (markerIndex !== -1) {
            const endOfMarkerIndex = markerIndex + endMarker.length;
            controller.enqueue(
              encoder.encode(buffer.slice(0, endOfMarkerIndex)),
            );
            buffer = buffer.slice(endOfMarkerIndex);
            phase = "outer-tail";
          } else {
            controller.enqueue(encoder.encode(buffer));
            buffer = "";
          }
        }

        if (phase === "inner-shell") {
          const { done, value } = await innerReader.read();
          if (done) {
            if (buffer) controller.enqueue(encoder.encode(buffer));
            phase = "outer-tail";
          } else {
            buffer += decoder.decode(value, { stream: true });
            const markerIndex = buffer.indexOf(endMarker);
            if (markerIndex !== -1) {
              const endOfMarkerIndex = markerIndex + endMarker.length;
              controller.enqueue(
                encoder.encode(buffer.slice(0, endOfMarkerIndex)),
              );
              buffer = buffer.slice(endOfMarkerIndex);
              phase = "outer-tail";
            } else {
              const flushIndex = buffer.lastIndexOf("\n");
              if (flushIndex !== -1) {
                controller.enqueue(
                  encoder.encode(buffer.slice(0, flushIndex + 1)),
                );
                buffer = buffer.slice(flushIndex + 1);
              }
            }
          }
        }
      } else if (phase === "outer-tail") {
        if (outerBufferRemains) {
          buffer += outerBufferRemains;
          outerBufferRemains = "";
        }
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) controller.enqueue(encoder.encode(buffer));
          phase = "inner-suspended";
        } else {
          buffer += decoder.decode(value, { stream: true });
          const markerIndex = buffer.indexOf("</body>");
          if (markerIndex !== -1) {
            controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
            outerBufferRemains = buffer.slice(markerIndex);
            buffer = "";
            phase = "inner-suspended";
          } else {
            const flushIndex = buffer.lastIndexOf("\n");
            if (flushIndex !== -1) {
              controller.enqueue(
                encoder.encode(buffer.slice(0, flushIndex + 1)),
              );
              buffer = buffer.slice(flushIndex + 1);
            }
          }
        }
      } else if (phase === "inner-suspended") {
        if (buffer) {
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }
        const { done, value } = await innerReader.read();
        if (done) {
          phase = "outer-end";
        } else {
          controller.enqueue(value);
        }
      } else if (phase === "outer-end") {
        if (outerBufferRemains) {
          controller.enqueue(encoder.encode(outerBufferRemains));
          outerBufferRemains = "";
        }
        const { done, value } = await outerReader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      }

      // Continue pumping
      return pump(controller);
    } catch (error) {
      controller.error(error);
    }
  };

  return new ReadableStream({
    start(controller) {
      outerReader = outerHtml.getReader();
      innerReader = innerHtml.getReader();
      pump(controller);
    },
    cancel() {
      outerReader?.cancel();
      innerReader?.cancel();
    },
  });
}
