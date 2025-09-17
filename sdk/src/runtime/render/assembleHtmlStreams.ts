import {
  PreambleExtractor,
  BodyContentExtractor,
} from "../lib/streamExtractors.js";
import { StreamStitcher } from "../lib/StreamStitcher.js";

export interface AssembleHtmlStreamsOptions {
  reactShellStream: ReadableStream<Uint8Array>;
  documentStream: ReadableStream<Uint8Array>;
  placeholder: string;
}

/**
 * Assembles the final HTML stream by extracting the preamble and body content
 * from React's shell stream and stitching them into the user's document stream.
 */
export const assembleHtmlStreams = ({
  reactShellStream,
  documentStream,
  placeholder,
}: AssembleHtmlStreamsOptions): ReadableStream<Uint8Array> => {
  // Set up streaming extraction of the preamble and app body
  const [shellStreamForPreamble, shellStreamForBody] = reactShellStream.tee();

  const preambleExtractor = new PreambleExtractor();
  // Consume the stream for its side-effect of resolving the promise
  shellStreamForPreamble.pipeTo(preambleExtractor);
  const preamblePromise = preambleExtractor.preamble;

  const bodyExtractor = new BodyContentExtractor();
  const appContentStream = shellStreamForBody.pipeThrough(bodyExtractor);

  // Stitch them together using the generic StreamStitcher
  const stitcher = new StreamStitcher({
    stringReplacements: [
      {
        search: "</head>",
        replace: async () => {
          const preamble = await preamblePromise;
          return `${preamble}</head>`;
        },
      },
    ],
    streamReplacements: [
      {
        placeholder,
        stream: appContentStream,
      },
    ],
  });

  return documentStream.pipeThrough(stitcher);
};
