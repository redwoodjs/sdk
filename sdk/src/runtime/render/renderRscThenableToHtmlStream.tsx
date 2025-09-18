import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { type DocumentProps } from "../lib/router.js";
import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";
import { getManifest } from "../lib/manifest.js";

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

  // Prepare bootstrap options based on detected entry scripts
  const bootstrapOptions: {
    nonce: string;
    bootstrapModules?: string[];
    bootstrapScriptContent?: string;
  } = {
    nonce: requestInfo.rw.nonce,
  };

  // If we have external entry scripts, use bootstrapModules
  if (requestInfo.rw.entryScripts.size > 0) {
    const manifest = await getManifest();
    const resolvedPaths: string[] = [];

    for (const sourcePath of requestInfo.rw.entryScripts) {
      // In development, use the source path as-is
      if (import.meta.env.VITE_IS_DEV_SERVER) {
        resolvedPaths.push(sourcePath);
      } else {
        // In production, resolve to the final hashed asset path
        const manifestEntry = manifest[sourcePath];
        if (manifestEntry?.file) {
          resolvedPaths.push(`/${manifestEntry.file}`);
        } else {
          // Fallback to source path if not found in manifest
          resolvedPaths.push(sourcePath);
        }
      }
    }

    bootstrapOptions.bootstrapModules = resolvedPaths;
  }

  // If we have inline entry scripts, use bootstrapScriptContent
  if (requestInfo.rw.inlineScripts.size > 0) {
    // Combine all inline scripts
    bootstrapOptions.bootstrapScriptContent = Array.from(
      requestInfo.rw.inlineScripts,
    ).join("\n");
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
