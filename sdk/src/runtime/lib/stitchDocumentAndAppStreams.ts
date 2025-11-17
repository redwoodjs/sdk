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

/**
 * A utility that orchestrates and interleaves three ReadableStreams to produce a
 * single, valid HTML response stream. It uses two special markers:
 *
 * - `startMarker`: Placed in the `outerHtml` stream (the document shell) to
 *   designate where the application's content should be injected.
 * - `endMarker`: Injected into the `innerHtml` stream's RSC payload to signal
 *   the end of the initial, non-suspended render. This marker is needed for
 *   non-blocking hydration, as it allows the stitching process to send the
 *   client `<script>` tags before all suspended content has resolved.
 *
 * It manages three main stream readers:
 *
 * - `hoistedTagsReader`: Reads from the `hoistedTagsStream`, which contains only
 *   the hoisted meta tags (e.g., `<title>`, `<meta>`).
 * - `outerReader`: Reads from the `outerHtml` stream, which is the server-rendered
 *   document shell (containing `<html>`, `<head>`, etc.).
 * - `innerReader`: Reads from the `appBodyStream`, which contains the main
 *   application content, stripped of its hoisted tags.
 *
 * The function proceeds through a multi-phase state machine, managed by the
 * `pump` function, to correctly interleave these streams.
 *
 * The state machine moves through the following phases:
 *
 * 1. `read-hoisted`:
 *    - **Goal:** Buffer all hoisted tags from the `hoistedTagsStream`.
 *    - **Action:** Reads from `hoistedTagsReader` and appends all content into
 *      the `hoistedTagsBuffer`. Does not enqueue anything yet.
 *    - **Transition:** Moves to `outer-head` when the stream is exhausted.
 *
 * 2. `outer-head`:
 *    - **Goal:** Stream the document up to the closing `</head>` tag, inject the
 *      hoisted tags, and then continue until the app `startMarker`.
 *    - **Action:** Reads from `outerReader`. When it finds `</head>`, it enqueues
 *      the content before it, then enqueues the `hoistedTagsBuffer`, and finally
 *      enqueues the `</head>` tag itself. It then continues reading from
 *      `outerReader` until it finds the `startMarker`.
 *    - **Transition:** Moves to `inner-shell` after finding and discarding the
 *      `startMarker`.
 *
 * 3. `inner-shell`:
 *    - **Goal:** Stream the initial, non-suspended part of the application.
 *    - **Action:** Switches to `innerReader`. It enqueues chunks until it finds
 *      the `endMarker`. Any content after the marker is stored in
 *      `innerSuspendedRemains`.
 *    - **Transition:** Moves to `outer-tail` after finding the `endMarker`.
 *
 * 4. `outer-tail`:
 *    - **Goal:** Stream the rest of the document's `<body>`, including client
 *      `<script>` tags.
 *    - **Action:** Switches back to `outerReader` and enqueues chunks until it
 *      finds the `</body>` tag.
 *    - **Transition:** Moves to `inner-suspended` after finding `</body>`.
 *
 * 5. `inner-suspended`:
 *    - **Goal:** Stream any suspended content from the React app.
 *    - **Action:** First enqueues any content from `innerSuspendedRemains`, then
 *      continues reading from `innerReader` until the stream is exhausted.
 *    - **Transition:** Moves to `outer-end` when the stream is exhausted.
 *
 * 6. `outer-end`:
 *    - **Goal:** Finish the document.
 *    - **Action:** Switches back to `outerReader` for the last time to send the
 *      closing `</body>` and `</html>` tags.
 */
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
  let hoistedTagsBuffer = "";
  let hoistedTagsReady = false;
  let phase:
    | "read-hoisted"
    | "outer-head"
    | "inner-shell"
    | "outer-tail"
    | "inner-suspended"
    | "outer-end" = "read-hoisted";

  const pump = async (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): Promise<void> => {
    const enqueue = (text: string) => {
      if (text) {
        controller.enqueue(encoder.encode(text));
      }
    };

    const flush = () => {
      const flushIndex = buffer.lastIndexOf("\n");
      if (flushIndex !== -1) {
        enqueue(buffer.slice(0, flushIndex + 1));
        buffer = buffer.slice(flushIndex + 1);
      }
    };

    try {
      if (phase === "read-hoisted") {
        // Continuously read from the hoisted tags stream and buffer the
        // content. Once the stream is finished, transition to the next phase.
        const { done, value } = await hoistedTagsReader.read();
        if (done) {
          hoistedTagsReady = true;
          phase = "outer-head";
        } else {
          hoistedTagsBuffer += decoder.decode(value, { stream: true });
        }
      } else if (phase === "outer-head") {
        // Read from the document stream. Search for the closing `</head>` tag
        // to inject the buffered hoisted tags. Then, search for the
        // `startMarker` to know when to start injecting the app shell. Once
        // the marker is found, transition to the next phase.
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) {
            const headCloseIndex = buffer.indexOf("</head>");
            if (
              headCloseIndex !== -1 &&
              hoistedTagsReady &&
              hoistedTagsBuffer
            ) {
              enqueue(buffer.slice(0, headCloseIndex));
              enqueue(hoistedTagsBuffer);
              hoistedTagsBuffer = "";
              enqueue("</head>");
              buffer = buffer.slice(headCloseIndex + "</head>".length);
            }

            const markerIndex = buffer.indexOf(startMarker);
            if (markerIndex !== -1) {
              enqueue(buffer.slice(0, markerIndex));
              outerBufferRemains = buffer.slice(
                markerIndex + startMarker.length,
              );
            } else {
              enqueue(buffer);
            }
            buffer = "";
          } else if (hoistedTagsReady && hoistedTagsBuffer) {
            enqueue(hoistedTagsBuffer);
            hoistedTagsBuffer = "";
          }
          phase = "inner-shell";
        } else {
          buffer += decoder.decode(value, { stream: true });

          const headCloseIndex = buffer.indexOf("</head>");
          if (headCloseIndex !== -1 && hoistedTagsReady && hoistedTagsBuffer) {
            enqueue(buffer.slice(0, headCloseIndex));
            enqueue(hoistedTagsBuffer);
            hoistedTagsBuffer = "";
            enqueue("</head>");
            buffer = buffer.slice(headCloseIndex + "</head>".length);
          }

          const markerIndex = buffer.indexOf(startMarker);
          if (markerIndex !== -1) {
            enqueue(buffer.slice(0, markerIndex));
            outerBufferRemains = buffer.slice(markerIndex + startMarker.length);
            buffer = "";
            phase = "inner-shell";
          } else {
            flush();
          }
        }
      } else if (phase === "inner-shell") {
        // Now read from the app stream. We send the initial part of the app
        // content until we find the `endMarker`. This marker tells us that the
        // non-suspended part of the app is rendered. Any content after this
        // marker is considered suspended and is buffered. Then, transition.
        const { done, value } = await innerReader.read();
        if (done) {
          if (buffer) enqueue(buffer);
          phase = "outer-tail";
        } else {
          buffer += decoder.decode(value, { stream: true });
          const markerIndex = buffer.indexOf(endMarker);
          if (markerIndex !== -1) {
            const endOfMarkerIndex = markerIndex + endMarker.length;
            enqueue(buffer.slice(0, endOfMarkerIndex));
            innerSuspendedRemains = buffer.slice(endOfMarkerIndex);
            buffer = "";
            phase = "outer-tail";
          } else {
            flush();
          }
        }
      } else if (phase === "outer-tail") {
        // Switch back to the document stream. The goal is to send the rest of
        // the document's body, which critically includes the client-side
        // `<script>` tags for hydration. We stream until we find the closing
        // `</body>` tag and then transition.
        if (outerBufferRemains) {
          buffer = outerBufferRemains;
          outerBufferRemains = "";
        }
        const { done, value } = await outerReader.read();
        if (done) {
          if (buffer) {
            const markerIndex = buffer.indexOf("</body>");
            if (markerIndex !== -1) {
              enqueue(buffer.slice(0, markerIndex));
              buffer = buffer.slice(markerIndex);
            } else {
              enqueue(buffer);
              buffer = "";
            }
          }
          phase = "inner-suspended";
        } else {
          buffer += decoder.decode(value, { stream: true });
          const markerIndex = buffer.indexOf("</body>");
          if (markerIndex !== -1) {
            enqueue(buffer.slice(0, markerIndex));
            buffer = buffer.slice(markerIndex);
            phase = "inner-suspended";
          } else {
            flush();
          }
        }
      } else if (phase === "inner-suspended") {
        // Switch back to the app stream. First, send any buffered suspended
        // content from the `inner-shell` phase. Then, stream the rest of the
        // app content until it's finished. This is all the content that was
        // behind a `<Suspense>` boundary.
        if (innerSuspendedRemains) {
          enqueue(innerSuspendedRemains);
          innerSuspendedRemains = "";
        }
        const { done, value } = await innerReader.read();
        if (done) {
          phase = "outer-end";
        } else {
          controller.enqueue(value);
        }
      } else if (phase === "outer-end") {
        // Finally, switch back to the document stream one last time to send
        // the closing `</body>` and `</html>` tags and finish the response.
        if (buffer) {
          enqueue(buffer);
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
