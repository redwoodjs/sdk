import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router.js";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";
import { default as clientManifest } from "virtual:rwsdk:manifest.js";

export const renderRscThenableToHtmlStream = async ({
  thenable,
  Document,
  requestInfo,
  shouldSSR,
  onError,
}: {
  thenable: any;
  Document: React.FC<DocumentProps>;
  requestInfo: RequestInfo;
  shouldSSR: boolean;
  onError: (error: unknown) => void;
}) => {
  const Component = () => {
    const RscApp = () => {
      const node = (use(thenable) as { node: React.ReactNode }).node;

      return (
        <>
          <Stylesheets requestInfo={requestInfo} />
          <Preloads requestInfo={requestInfo} />
          <div id="hydrate-root">{node}</div>
        </>
      );
    };

    // todo(justinvdm, 18 Jun 2025): We can build on this later to allow users
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

    return (
      <Document {...requestInfo}>
        <script
          nonce={requestInfo.rw.nonce}
          dangerouslySetInnerHTML={{
            __html: `globalThis.__RWSDK_CONTEXT = ${JSON.stringify(
              clientContext,
            )}`,
          }}
        />
        <RscApp />
      </Document>
    );
  };

  const bootstrapOptions: Record<string, any> = {
    nonce: requestInfo.rw.nonce,
  };

  const { entryScripts, inlineScripts } = requestInfo.rw;

  if (entryScripts?.size > 0) {
    if (process.env.VITE_IS_DEV_SERVER === "1") {
      bootstrapOptions.bootstrapModules = Array.from(entryScripts);
    } else {
      bootstrapOptions.bootstrapModules = Array.from(entryScripts).map(
        (entry) => clientManifest[entry]?.file || entry,
      );
    }
  } else if (inlineScripts?.size > 0) {
    bootstrapOptions.bootstrapScriptContent =
      Array.from(inlineScripts).join(";");
  }

  return await renderToReadableStream(<Component />, {
    ...bootstrapOptions,
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
