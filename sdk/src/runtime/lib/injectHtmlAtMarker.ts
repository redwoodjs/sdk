/**
 * Injects HTML content from one stream into another stream at a specified marker.
 * This preserves streaming behavior by processing chunks incrementally without
 * buffering the entire streams.
 *
 * @param outerHtml - The outer HTML stream containing the marker
 * @param innerHtml - The inner HTML stream to inject at the marker
 * @param marker - The text marker where injection should occur
 * @returns A new ReadableStream with the inner HTML injected at the marker
 */
export function injectHtmlAtMarker(
  outerHtml: ReadableStream<Uint8Array>,
  innerHtml: ReadableStream<Uint8Array>,
  marker: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let injected = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const outerReader = outerHtml.getReader();

      const flushText = (text: string) => {
        if (text.length > 0) {
          controller.enqueue(encoder.encode(text));
        }
      };

      const pumpInnerStream = async () => {
        const innerReader = innerHtml.getReader();
        try {
          while (true) {
            const { done, value } = await innerReader.read();
            if (done) {
              break;
            }
            controller.enqueue(value);
          }
        } finally {
          innerReader.releaseLock();
        }
      };

      try {
        while (true) {
          const { done, value } = await outerReader.read();
          if (done) {
            // End of outer stream - flush any remaining buffer
            if (buffer.length > 0) {
              flushText(buffer);
            }
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          if (!injected) {
            // Look for the marker in the buffer
            const markerIndex = buffer.indexOf(marker);
            if (markerIndex !== -1) {
              // Found the marker - emit everything before it
              flushText(buffer.slice(0, markerIndex));

              // Inject the inner HTML stream
              await pumpInnerStream();

              // Keep everything after the marker for next iteration
              buffer = buffer.slice(markerIndex + marker.length);
              injected = true;
            } else {
              // Marker not found yet - flush all but potential partial marker
              // Keep overlap to handle markers split across chunks
              const overlap = Math.max(0, marker.length - 1);
              const cutoff = Math.max(0, buffer.length - overlap);

              if (cutoff > 0) {
                flushText(buffer.slice(0, cutoff));
                buffer = buffer.slice(cutoff);
              }
            }
          } else {
            // Already injected - just pass through remaining content
            flushText(buffer);
            buffer = "";
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        outerReader.releaseLock();
      }
    },
  });
}
