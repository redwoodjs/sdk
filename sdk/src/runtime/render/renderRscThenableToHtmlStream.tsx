import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  requestInfo,
  shouldSSR,
  onError,
}: {
  thenable: any;
  requestInfo: RequestInfo;
  shouldSSR: boolean;
  onError: (error: unknown) => void;
}) => {
  console.log(
    "--- DEBUG: [renderRscThenableToHtmlStream] - Starting render ---",
  );
  const RscApp = () => {
    const node = (use(thenable) as { node: React.ReactNode }).node;

    return (
      <html>
        <head>
          <Stylesheets requestInfo={requestInfo} />
          <Preloads requestInfo={requestInfo} />
        </head>
        <body>
          <div id="hydrate-root">{node}</div>
        </body>
      </html>
    );
  };

  // context(justinvdm, 18 Jun 2025): We can build on this later to allow users
  // surface context. e.g:
  // * we assign `user: requestInfo.clientCtx` here
  // * user populates requestInfo.clientCtx on worker side
  // * user can import a read only `import { clientCtx } from "rwsdk/client"`
  // on client side
  const clientContext = {
    rw: {
      ssr: shouldSSR,
    },
  };

  const stream = await renderToReadableStream(<RscApp />, {
    bootstrapScriptContent: `globalThis.__RWSDK_CONTEXT = ${JSON.stringify(
      clientContext,
    )}`,
    nonce: requestInfo.rw.nonce,
    onError(error, { componentStack }) {
      console.error(
        "--- DEBUG: [renderRscThenableToHtmlStream] - onError callback triggered ---",
        { error, componentStack },
      );
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

  console.log(
    "--- DEBUG: [renderRscThenableToHtmlStream] - Render complete, returning stream ---",
  );
  return stream;
};
