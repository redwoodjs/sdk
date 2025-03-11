export const generateNonce = (): string =>
  btoa(crypto.getRandomValues(new Uint8Array(16)).join(""));
