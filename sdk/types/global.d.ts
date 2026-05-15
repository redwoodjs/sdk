import { ViteHotContext } from "vite/types/hot";

declare global {
  var __webpack_require__: (id: string) => unknown;
  interface ImportMeta {
    hot?: ViteHotContext;
  }
}

export {};
