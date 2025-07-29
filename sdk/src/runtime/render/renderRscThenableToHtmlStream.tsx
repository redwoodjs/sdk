import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router";
import { type RequestInfo } from "../requestInfo/types";
import { getManifest } from "../lib/manifest";

const findCssForModule = (
  scriptId: string,
  manifest: Record<string, { file: string; css?: string[] }>,
) => {
  const css = new Set<string>();
  const visited = new Set<string>();

  const inner = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);

    const entry = manifest[id];
    if (!entry) {
      return;
    }

    if (entry.css) {
      for (const href of entry.css) {
        css.add(href);
      }
    }
  };

  inner(scriptId);

  return Array.from(css);
};

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
      const manifest = use(getManifest(requestInfo));
      const allStylesheets = new Set<string>();

      for (const scriptId of requestInfo.rw.scriptsToBeLoaded) {
        const css = findCssForModule(scriptId, manifest);
        for (const href of css) {
          allStylesheets.add(href);
        }
      }

      return (
        <>
          {Array.from(allStylesheets).map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
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
