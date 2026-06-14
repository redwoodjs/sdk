import DefaultOnly from "../client/DefaultOnly";
import MixedDefault, { MixedNamed } from "../client/Mixed";
import { DynamicHost } from "../client/DynamicHost";
import { NamedButton, NamedLabel } from "../client/Named";
import { ReExportedButton } from "../client/Barrel";
import { ServerProofClient } from "../client/ServerProof.client";
import { DuplicateA } from "../client/duplicate/a/Duplicate";
import { DuplicateB } from "../client/duplicate/b/Duplicate";

export const Home = () => {
  return (
    <div>
      <h1>Hello World</h1>
      <section data-proof="vite-rsc-client-adapter-fixture">
        <NamedButton />
        <NamedLabel />
        <DefaultOnly />
        <MixedDefault />
        <MixedNamed />
        <ReExportedButton />
        <DuplicateA />
        <DuplicateB />
        <DynamicHost />
        <ServerProofClient />
      </section>
    </div>
  );
};
