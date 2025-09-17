import {
  PreambleExtractor,
  BodyContentExtractor,
} from "../lib/streamExtractors.js";

export interface AssembleHtmlStreamsOptions {
  reactShellStream: ReadableStream<Uint8Array>;
  documentStream: ReadableStream<Uint8Array>;
  placeholder: string;
}

/**
 * Coalesces two HTML streams (the user's Document and React's shell) into a
 * single, final HTML stream. It intelligently merges the head and body content
 * from both, preserving the user's Document structure while injecting React's
 * necessary hydration preamble and application markup.
 */
export const assembleHtmlStreams = ({
  reactShellStream,
  documentStream,
  placeholder,
}: AssembleHtmlStreamsOptions): ReadableStream<Uint8Array> => {
  // Set up streaming extraction of the preamble and app body from React's shell
  const [shellStreamForPreamble, shellStreamForBody] = reactShellStream.tee();

  const preambleExtractor = new PreambleExtractor();
  shellStreamForPreamble.pipeTo(preambleExtractor);
  const preamblePromise = preambleExtractor.preamble;

  const bodyExtractor = new BodyContentExtractor();
  const appContentStream = shellStreamForBody.pipeThrough(bodyExtractor);

  return new ReadableStream({
    async start(controller) {
      const docReader = documentStream.getReader();
      const appReader = appContentStream.getReader();
      const textEncoder = new TextEncoder();
      const textDecoder = new TextDecoder();
      let docBuffer = "";
      let docDone = false;
      let headInjected = false;
      let bodyInjected = false;

      try {
        while (true) {
          // Read from the document stream if it's not done yet
          if (!docDone) {
            const { done, value } = await docReader.read();
            if (done) {
              docDone = true;
            } else {
              docBuffer += textDecoder.decode(value, { stream: true });
            }
          }

          // Process head injection
          if (!headInjected) {
            const headEndIndex = docBuffer.indexOf("</head>");
            if (headEndIndex !== -1) {
              const before = docBuffer.substring(0, headEndIndex);
              const after = docBuffer.substring(headEndIndex);
              docBuffer = after;

              controller.enqueue(textEncoder.encode(before));
              const preamble = await preamblePromise;
              controller.enqueue(textEncoder.encode(preamble));
              headInjected = true;
            }
          }

          // Process body injection
          if (headInjected && !bodyInjected) {
            const placeholderIndex = docBuffer.indexOf(placeholder);
            if (placeholderIndex !== -1) {
              const before = docBuffer.substring(0, placeholderIndex);
              const after = docBuffer.substring(
                placeholderIndex + placeholder.length,
              );
              docBuffer = after;

              controller.enqueue(textEncoder.encode(before));

              // Pipe the entire app content stream through
              while (true) {
                const { done, value } = await appReader.read();
                if (done) break;
                controller.enqueue(value);
              }
              bodyInjected = true;
            }
          }

          // If we are done with the document stream and all injections are complete,
          // we can flush the remaining buffer and finish.
          if (docDone) {
            if (docBuffer.length > 0) {
              controller.enqueue(textEncoder.encode(docBuffer));
            }
            break; // Exit the loop
          }

          // If we haven't found our injection points yet, we need more data from
          // the document stream, so we don't flush the buffer and continue the loop.
          if (!headInjected || !bodyInjected) {
            continue;
          }

          // If we've done all injections but are not at the end of the doc stream,
          // we can flush the buffer and then continue to pipe the rest of the doc.
          if (docBuffer.length > 0) {
            controller.enqueue(textEncoder.encode(docBuffer));
            docBuffer = "";
          }
        }
      } finally {
        controller.close();
      }
    },
  });
};
