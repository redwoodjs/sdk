import { ReactElement, FC } from "react";
import { DocumentProps } from "../lib/router.js";
import { renderToRscStream } from "./renderToRscStream.js";
import { transformRscToHtmlStream } from "./transformRscToHtmlStream.js";
import { requestInfo } from "../requestInfo/worker.js";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderDocumentToStream } from "rwsdk/__ssr_bridge";
import { TextDecoder } from "node:util";

export interface RenderToStreamOptions {
  Document?: FC<DocumentProps>;
  injectRscPayload?: boolean;
  onError?: (error: unknown) => void;
}

export const IdentityDocument: FC<DocumentProps> = ({ children }) => (
  <>{children}</>
);

// A TransformStream that buffers the input stream until a sentinel string is found.
// It resolves a promise with the buffered content up to and including the sentinel,
// and passes the rest of the stream through.
class PreambleExtractor extends TransformStream<Uint8Array, Uint8Array> {
  #sentinel = new TextEncoder().encode("</head>");
  #buffer: Uint8Array = new Uint8Array();
  #decoder = new TextDecoder();
  #preamblePromise: Promise<string>;
  #preambleResolver!: (preamble: string) => void;
  #found = false;

  constructor() {
    super({
      transform: (chunk, controller) => {
        if (this.#found) {
          controller.enqueue(chunk);
          return;
        }
        this.#buffer = new Uint8Array([...this.#buffer, ...chunk]);
        const bufferAsString = this.#decoder.decode(this.#buffer, {
          stream: true,
        });
        const sentinelIndex = bufferAsString.indexOf("</head>");

        if (sentinelIndex !== -1) {
          this.#found = true;
          const headContent = bufferAsString.substring(0, sentinelIndex);
          const preamble = headContent.match(/<head>(.*)/s)?.[1] ?? "";
          this.#preambleResolver(preamble);

          const restOfBufferIndex =
            this.#buffer.length -
            (bufferAsString.length - (sentinelIndex + "</head>".length));
          const restOfBuffer = this.#buffer.subarray(restOfBufferIndex);

          controller.enqueue(restOfBuffer);
        }
      },
      flush: () => {
        if (!this.#found) {
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

export const renderToStream = async (
  element: ReactElement,
  {
    Document = IdentityDocument,
    injectRSCPayload: shouldInjectRSCPayload = false,
    onError = () => {},
  }: RenderToStreamOptions = {},
): Promise<ReadableStream> => {
  let rscStream = renderToRscStream({
    node: element,
    actionResult: null,
    onError,
  });

  if (shouldInjectRSCPayload) {
    const [rscPayloadStream1, rscPayloadStream2] = rscStream.tee();
    rscStream = rscPayloadStream1;

    rscStream = rscStream.pipeThrough(
      injectRSCPayload(rscPayloadStream2, {
        nonce: requestInfo.rw.nonce,
      }),
    );
  }

  const reactShellStream = await transformRscToHtmlStream({
    stream: rscStream,
    requestInfo,
    onError,
  });

  // PASS 1: Set up a streaming extraction of the preamble and app body
  const [shellStreamForPreamble, shellStreamForBody] = reactShellStream.tee();
  const preambleExtractor = new PreambleExtractor();
  const appHtmlStream = shellStreamForPreamble.pipeThrough(preambleExtractor);
  const preamblePromise = preambleExtractor.preamble;

  // PASS 2: Render the user's Document with a placeholder
  const placeholder = `<div id="__RWS_APP_HTML__"></div>`;
  const documentStream = await renderDocumentToStream(
    Document,
    requestInfo,
    placeholder,
  );

  // Stitch them together in a streaming fashion
  const stitcher = new TransformStream({
    async transform(chunk, controller) {
      const chunkAsString = new TextDecoder().decode(chunk);
      if (chunkAsString.includes("</head>")) {
        const preamble = await preamblePromise;
        controller.enqueue(
          new TextEncoder().encode(
            chunkAsString.replace("</head>", `${preamble}</head>`),
          ),
        );
      } else if (chunkAsString.includes(placeholder)) {
        controller.enqueue(
          new TextEncoder().encode(chunkAsString.split(placeholder)[0]),
        );
        const reader = shellStreamForBody
          .pipeThrough(preambleExtractor)
          .getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.enqueue(
          new TextEncoder().encode(chunkAsString.split(placeholder)[1]),
        );
      } else {
        controller.enqueue(chunk);
      }
    },
  });

  return documentStream.pipeThrough(stitcher);
};
