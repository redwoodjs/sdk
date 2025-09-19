import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type RequestInfo } from "../requestInfo/types.js";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  requestInfo,
  onError,
}: {
  thenable: any;
  requestInfo: RequestInfo;
  onError: (error: unknown) => void;
}) => {
  const Component = () => {
    return (use(thenable) as { node: React.ReactNode }).node;
  };

  return await renderToReadableStream(<Component />, {
    nonce: requestInfo.rw.nonce,
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
