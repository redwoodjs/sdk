interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_IS_DEV_SERVER: string;
  readonly VITE_RWSDK_BUILD_ID: string;
  readonly VITE_RWSDK_SYNCED_STATE_TEST_FAST_RECONNECT?: string;
  readonly BASE_URL: string;
}
