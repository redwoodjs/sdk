import { ReExportedButton } from "../client/Barrel";
import DefaultOnly from "../client/DefaultOnly";
import { DynamicHost } from "../client/DynamicHost";
import MixedDefault, { MixedNamed } from "../client/Mixed";
import { NamedButton, NamedLabel } from "../client/Named";
import { ServerProofClient } from "../client/ServerProof.client";
import { DuplicateA } from "../client/duplicate/a/Duplicate";
import { DuplicateB } from "../client/duplicate/b/Duplicate";

export const NamedCanary = () => (
  <main>
    <h1>plugin-rsc canary named</h1>
    <NamedButton />
    <NamedLabel />
  </main>
);

export const DefaultCanary = () => (
  <main>
    <h1>plugin-rsc canary default</h1>
    <DefaultOnly />
  </main>
);

export const MixedCanary = () => (
  <main>
    <h1>plugin-rsc canary mixed</h1>
    <MixedDefault />
    <MixedNamed />
  </main>
);

export const ReExportCanary = () => (
  <main>
    <h1>plugin-rsc canary re-export</h1>
    <ReExportedButton />
  </main>
);

export const DuplicateCanary = () => (
  <main>
    <h1>plugin-rsc canary duplicate</h1>
    <DuplicateA />
    <DuplicateB />
  </main>
);

export const DynamicCanary = () => (
  <main>
    <h1>plugin-rsc canary dynamic</h1>
    <DynamicHost />
  </main>
);

export const ServerProofCanary = () => (
  <main>
    <h1>plugin-rsc canary server proof</h1>
    <ServerProofClient />
  </main>
);

export const TypeDiagnosticCanary = () => (
  <main>
    <h1>plugin-rsc canary types</h1>
    <pre id="client-reference-types">
      {JSON.stringify({
        NamedButton: typeof NamedButton,
        NamedLabel: typeof NamedLabel,
        DefaultOnly: typeof DefaultOnly,
        MixedDefault: typeof MixedDefault,
        MixedNamed: typeof MixedNamed,
        ReExportedButton: typeof ReExportedButton,
        DuplicateA: typeof DuplicateA,
        DuplicateB: typeof DuplicateB,
        DynamicHost: typeof DynamicHost,
        ServerProofClient: typeof ServerProofClient,
      })}
    </pre>
  </main>
);
