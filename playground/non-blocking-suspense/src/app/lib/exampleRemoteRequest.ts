export async function fetchExampleRemoteRequest() {
  await new Promise<string>((resolve) => setTimeout(resolve, 3000));
  return "Hello from the remote request!";
}
