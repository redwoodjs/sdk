/// <reference types="node" />

/**
 * context(justin, 2026-07-19):
 * The `@xhmikosr/decompress` package ships ESM without bundled TypeScript
 * declarations. We provide this minimal declaration because the SDK only uses
 * the default exported function in `sdk/src/scripts/addon.mts` to extract a
 * downloaded tar.gz archive to a temporary directory. The shape matches the
 * previous `@types/decompress` declaration, which is no longer needed.
 */
declare module "@xhmikosr/decompress" {
  interface File {
    data: Buffer;
    mode: number;
    mtime: string;
    path: string;
    type: string;
  }

  interface DecompressOptions {
    filter?(file: File): boolean;
    map?(file: File): File;
    plugins?: unknown[] | undefined;
    strip?: number | undefined;
  }

  function decompress(
    input: string | Buffer,
    output?: string | DecompressOptions,
    opts?: DecompressOptions,
  ): Promise<File[]>;

  export default decompress;
}
