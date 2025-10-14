// Stub for client component so import doesn't break on the server
export const clientDep = () => {
  throw new Error("Cannot call clientDep on server");
};
export const serverDep = () => "from server dep";
export const plainDep = () => "from plain dep";
