/**
 * A utility to orchestrate and interleave two ReadableStreams (a document shell and an app shell)
 * based on a set of markers within their content. This is designed to solve a specific
 * race condition in streaming Server-Side Rendering (SSR) with Suspense.
 *
 * The logic is as follows:
 * 1. Stream the document until a start marker is found.
 * 2. Switch to the app stream and stream it until an end marker is found. This is the non-suspended shell.
 * 3. Switch back to the document stream and stream it until the closing body tag. This sends the client script.
 * 4. Switch back to the app stream and stream the remainder (the suspended content).
 * 5. Switch back to the document stream and stream the remainder (closing body and html tags).
 *
 * @param outerHtml The stream for the document shell (`<Document>`).
 * @param innerHtml The stream for the application's content.
 * @param startMarker The marker in the document to start injecting the app.
 * @param endMarker The marker in the app stream that signals the end of the initial, non-suspended render.
 */

function splitStreamOnFirstNonHoistedTag(
  sourceStream: ReadableStream<Uint8Array>,
): [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>] {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const nonHoistedTagPattern =
    /<(?!(?:\/)?(?:title|meta|link|style|base)[\s>\/])(?![!?])/i;

  let sourceReader: ReadableStreamDefaultReader<Uint8Array>;
  let appBodyController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let buffer = "";
  let hoistedTagsDone = false;

  const hoistedTagsStream = new ReadableStream<Uint8Array>({
    start(controller) {
      sourceReader = sourceStream.getReader();

      const pump = async () => {
        try {
          if (hoistedTagsDone) {
            controller.close();
            return;
          }

          const { done, value } = await sourceReader.read();

          if (done) {
            if (buffer) {
              const match = buffer.match(nonHoistedTagPattern);
              if (match && typeof match.index === "number") {
                const hoistedPart = buffer.slice(0, match.index);
                controller.enqueue(encoder.encode(hoistedPart));
              } else {
                controller.enqueue(encoder.encode(buffer));
              }
            }
            controller.close();
            hoistedTagsDone = true;
            if (appBodyController) {
              appBodyController.close();
            }
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const match = buffer.match(nonHoistedTagPattern);

          if (match && typeof match.index === "number") {
            const hoistedPart = buffer.slice(0, match.index);
            const appPart = buffer.slice(match.index);
            buffer = "";

            controller.enqueue(encoder.encode(hoistedPart));
            controller.close();
            hoistedTagsDone = true;

            if (appBodyController) {
              if (appPart) {
                appBodyController.enqueue(encoder.encode(appPart));
              }

              while (true) {
                const { done, value } = await sourceReader.read();
                if (done) {
                  appBodyController.close();
                  return;
                }
                appBodyController.enqueue(value);
              }
            }
          } else {
            const flushIndex = buffer.lastIndexOf("\n");
            if (flushIndex !== -1) {
              controller.enqueue(
                encoder.encode(buffer.slice(0, flushIndex + 1)),
              );
              buffer = buffer.slice(flushIndex + 1);
            }
            await pump();
          }
        } catch (e) {
          controller.error(e);
          if (appBodyController) {
            appBodyController.error(e);
          }
        }
      };

      pump().catch((e) => {
        controller.error(e);
        if (appBodyController) {
          appBodyController.error(e);
        }
      });
    },
  });

  const appBodyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      appBodyController = controller;
    },
  });

  return [hoistedTagsStream, appBodyStream];
}

export function stitchDocumentAndAppStreams(
  outerHtml: ReadableStream<Uint8Array>,
  innerHtml: ReadableStream<Uint8Array>,
  startMarker: string,
  endMarker: string,
): ReadableStream<Uint8Array> {
  const [hoistedTagsStream, appBodyStream] =
    splitStreamOnFirstNonHoistedTag(innerHtml);

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let outerReader: ReadableStreamDefaultReader<Uint8Array>;
  let innerReader: ReadableStreamDefaultReader<Uint8Array>;
  let hoistedTagsReader: ReadableStreamDefaultReader<Uint8Array>;

  let buffer = "";
  let outerBufferRemains = "";
  let innerSuspendedRemains = "";
  let phase:
    | "enqueue-hoisted"
    | "outer-head"
    | "inner-shell"
    | "outer-tail"
    | "inner-suspended"
    | "outer-end" = "enqueue-hoisted";

  const pump = async (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> => {
    try {
      if (phase === "enqueue-hoisted") {
        const { done, value } = await hoistedTagsReader.read();
        if (done) {
          phase = "outer-head";
        } else {
          controller.enqueue(value);
        }
      } else if (phase === "outer-head") {
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) {
            const markerIndex = buffer.indexOf(startMarker);
            if (markerIndex !== -1) {
              controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
              outerBufferRemains = buffer.slice(
                markerIndex + startMarker.length,
              );
            } else {
              controller.enqueue(encoder.encode(buffer));
            }
            buffer = "";
          }
          phase = "inner-shell";
        } else {
          buffer += decoder.decode(value, { stream: true });
          const markerIndex = buffer.indexOf(startMarker);
          if (markerIndex !== -1) {
            controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
            outerBufferRemains = buffer.slice(markerIndex + startMarker.length);
            buffer = "";
            phase = "inner-shell";
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
      } else if (phase === "inner-shell") {
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
            innerSuspendedRemains = buffer.slice(endOfMarkerIndex);
            buffer = "";
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
      } else if (phase === "outer-tail") {
        if (outerBufferRemains) {
          buffer = outerBufferRemains;
          outerBufferRemains = "";
        }
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) {
            const markerIndex = buffer.indexOf("</body>");
            if (markerIndex !== -1) {
              controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
              buffer = buffer.slice(markerIndex);
            } else {
              controller.enqueue(encoder.encode(buffer));
              buffer = "";
            }
          }
          phase = "inner-suspended";
        } else {
          buffer += decoder.decode(value, { stream: true });
          const markerIndex = buffer.indexOf("</body>");
          if (markerIndex !== -1) {
            controller.enqueue(encoder.encode(buffer.slice(0, markerIndex)));
            buffer = buffer.slice(markerIndex);
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
        if (innerSuspendedRemains) {
          controller.enqueue(encoder.encode(innerSuspendedRemains));
          innerSuspendedRemains = "";
        }
        const { done, value } = await innerReader.read();
        if (done) {
          phase = "outer-end";
        } else {
          controller.enqueue(value);
        }
      } else if (phase === "outer-end") {
        if (buffer) {
          controller.enqueue(encoder.encode(buffer));
          buffer = "";
        }
        const { done, value } = await outerReader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      }
      await pump(controller);
    } catch (e) {
      controller.error(e);
    }
  };

  return new ReadableStream({
    start(controller) {
      outerReader = outerHtml.getReader();
      innerReader = appBodyStream.getReader();
      hoistedTagsReader = hoistedTagsStream.getReader();
      pump(controller).catch((e) => controller.error(e));
    },
    cancel(reason) {
      outerReader?.cancel(reason);
      innerReader?.cancel(reason);
      hoistedTagsReader?.cancel(reason);
    },
  });
}
