// context(justinvdm, 28 May 2025): This is the "bridge" between the RSC side
// and the SSR side, both run inside the same runtime environment. We have this
// separation so that they can each be processed with their own respective
// import conditions and bundling logic
//
// **NOTE:** Any time we need to import from SSR side in RSC side, we need to
// import it through this bridge module, using the bare import path
// `rwsdk/__ssr_bridge`. We have bundler logic (ssrBridgePlugin) that looks out
// for imports to it.

export { createThenableFromReadableStream } from "./render/createThenableFromReadableStream";
export { renderHtmlStream } from "./render/renderHtmlStream";

export {
  ssrGetModuleExport,
  ssrLoadModule,
  ssrWebpackRequire,
} from "./imports/ssr";
