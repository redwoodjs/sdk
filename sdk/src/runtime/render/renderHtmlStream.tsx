import { renderToReadableStream } from "react-dom/server.edge";
import { type RequestInfo } from "../requestInfo/types.js";

export const renderHtmlStream = async ({
  node,
  identifierPrefix,
  requestInfo,
  onError,
  signal,
}: {
  node: React.ReactNode;
  requestInfo: RequestInfo;
  onError: (error: unknown) => void;
  identifierPrefix?: string;
  signal?: AbortSignal;
}) => {
  return await renderToReadableStream(node, {
    nonce: requestInfo.rw.nonce,
    identifierPrefix,
    signal,
    onError(error, { componentStack }) {
      try {
        if (!error) {
          error = new Error(
            `A falsy value was thrown during rendering: ${String(error)}.`,
          );
        }

        const message = error
          ? ((error as any).stack ?? (error as any).message ?? error)
          : error;

        const wrappedMessage = `${message}\n\nComponent stack:${componentStack}`;

        if (error instanceof Error) {
          const wrappedError = new Error(wrappedMessage);
          wrappedError.stack = error.stack;
          error = wrappedError;
        } else {
          error = new Error(wrappedMessage);
          (error as any).stack = componentStack;
        }

        onError(error);
      } catch {
        onError(error);
      }
    },
  });
};
