interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_IS_DEV_SERVER: string;
  readonly VITE_RWSDK_BUILD_ID: string;
  readonly BASE_URL: string;
}
