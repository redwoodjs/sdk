import { ServerProofClient } from "../client/ServerProof.client";

export const SsrFalse = () => {
  return (
    <main>
      <h1>SSR false proof</h1>
      <div data-proof="ssr-false-client">
        <ServerProofClient />
      </div>
    </main>
  );
};
