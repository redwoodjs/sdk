export const createClientManifest = () => {
  return new Proxy<ClientManifest>(
    {},
    {
      get(_, key) {
        return { id: key, name: key, chunks: [] };
      },
    }
  );
};
