// context(justinvdm, 28 May 2025): This is the "bridge" between the RSC side
// and and the SSR side, both run inside the same runtime environment. We have
// this separation so that they can each be processed with their own respective
// import conditions and bundling logic
//
// **NOTE:** Any time we need to import from SSR side in RSC side, we need to
// import it through this bridge file We have bundler logic (ssrBridgePlugin)
// that looks out for imports to this file
export { renderRscThenableToHtmlStream } from "./render/renderRscThenableToHtmlStream";
export { registeredServerFunctions } from "./register/ssr";
