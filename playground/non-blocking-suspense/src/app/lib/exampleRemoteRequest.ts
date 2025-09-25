export async function fetchExampleRemoteRequest() {
  return new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve("Hello from the remote request!");
    }, 3000);
  });
}
