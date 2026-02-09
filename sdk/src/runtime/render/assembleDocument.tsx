import { type RequestInfo } from "../requestInfo/types.js";
import { Preloads } from "./preloads.js";
import { Stylesheets } from "./stylesheets.js";

// Note: This is a server component, even though it doesn't have the "use server"
// directive. It's intended to be imported and used within the RSC render pass.
export const assembleDocument = ({
  requestInfo,
  pageElement,
  shouldSSR,
}: {
  requestInfo: RequestInfo;
  pageElement: React.ReactNode;
  shouldSSR: boolean;
}) => {
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

  const Document = requestInfo.rw.Document;

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
      <Stylesheets requestInfo={requestInfo} />
      <Preloads requestInfo={requestInfo} />
      <div id="hydrate-root">{pageElement}</div>
    </Document>
  );
};
