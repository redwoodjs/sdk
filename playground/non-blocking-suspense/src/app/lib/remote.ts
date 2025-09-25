export async function fetchExampleRemoteRequest() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "Hello from the remote request!";
}
