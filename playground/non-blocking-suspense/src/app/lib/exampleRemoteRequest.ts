let deferredResponse: PromiseWithResolvers<string> | null = null;

export function deferExampleRemoteRequest() {
  deferredResponse = Promise.withResolvers<string>();
}

export function resolveExampleRemoteRequest(givenResponse: string) {
  deferredResponse?.resolve(givenResponse);
}

export async function fetchExampleRemoteRequest() {
  // context(justinvdm, 2025-09-25): For testing purposes
  if (deferredResponse) {
    return await deferredResponse.promise;
  } else {
    await new Promise<string>((resolve) => setTimeout(resolve, 3000));
    return "Hello from the remote request!";
  }
}
