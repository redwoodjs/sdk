import type { Plugin } from "vite";

const PLUGIN_RSC_REACT_RSC_IMPORT = "@vitejs/plugin-rsc/react/rsc";
const VIRTUAL_MODULE_ID = "\0rwsdk:vite-rsc-runtime-bridge";
const ENCODED_VIRTUAL_MODULE_ID = "__x00__rwsdk:vite-rsc-runtime-bridge";

const isPluginRscReactRscImport = (source: string) =>
  source === PLUGIN_RSC_REACT_RSC_IMPORT ||
  source.endsWith("/@vitejs/plugin-rsc/dist/react/rsc.js") ||
  source.includes("/node_modules/@vitejs/plugin-rsc/dist/react/rsc.js");

export const viteRscRuntimeBridgePlugin = (): Plugin => ({
  name: "rwsdk:vite-rsc-runtime-bridge",
  enforce: "pre",
  resolveId(source) {
    if (
      isPluginRscReactRscImport(source) ||
      source === VIRTUAL_MODULE_ID ||
      source === ENCODED_VIRTUAL_MODULE_ID
    ) {
      return VIRTUAL_MODULE_ID;
    }

    return null;
  },
  load(id) {
    if (id !== VIRTUAL_MODULE_ID && id !== ENCODED_VIRTUAL_MODULE_ID) {
      return null;
    }

    // plugin-rsc's `rsc:use-client` transform imports
    // `@vitejs/plugin-rsc/react/rsc` to call `registerClientReference` in the
    // server/RSC environment. The package runtime currently reaches CommonJS
    // `require`, which is unavailable inside Cloudflare workerd. Redwood only
    // enables plugin-rsc's client-reference path by default, so this ESM bridge
    // exposes the server.edge APIs that path needs and fails loudly if a disabled
    // plugin-rsc server-reference/client-reader path is accidentally exercised.
    return `
import {
  registerClientReference as baseRegisterClientReference,
  registerServerReference as baseRegisterServerReference,
  decodeReply,
  decodeAction,
  decodeFormState,
  renderToReadableStream,
  createTemporaryReferenceSet,
} from "react-server-dom-webpack/server.edge";

export const registerClientReference = (proxy, id, name) => {
  const reference = baseRegisterClientReference(proxy, id, name);

  // Redwood's router/worker runtime needs to recognize plugin-rsc client
  // references so it can pass safe route props and avoid invoking route-level
  // use-client components as normal server functions.
  Object.defineProperties(reference, {
    $$async: { value: false },
    $$isClientReference: { value: true },
  });

  return reference;
};

export const registerServerReference = (action, id, name) => {
  const reference = baseRegisterServerReference(action, id, name);
  if (typeof reference === "function" && action?.method) {
    reference.method = action.method;
  }
  return reference;
};

export {
  decodeReply,
  decodeAction,
  decodeFormState,
  renderToReadableStream,
  createTemporaryReferenceSet,
};

export const createFromReadableStream = () => {
  throw new Error("plugin-rsc createFromReadableStream is not used by Redwood's client-reference compatibility path");
};
export const encodeReply = () => {
  throw new Error("plugin-rsc encodeReply is not used by Redwood's client-reference compatibility path");
};
export const createClientTemporaryReferenceSet = () => new Map();
export const loadServerAction = () => {
  throw new Error("plugin-rsc loadServerAction is disabled; Redwood serverAction/serverQuery own server functions");
};
export const setRequireModule = () => {};
`;
  },
});
