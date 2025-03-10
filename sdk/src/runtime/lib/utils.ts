export const isDev = (): boolean =>
  typeof import.meta.env !== "undefined" && import.meta.env.DEV;

export const generateNonce = (): string =>
  btoa(crypto.getRandomValues(new Uint8Array(16)).join(""));
