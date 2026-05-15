export async function fetchExampleRemoteRequest() {
  await new Promise((resolve) => setTimeout(resolve, 6000));
  return "Hello from the remote request!";
}
