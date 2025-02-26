export const createModuleMap = () =>
  new Proxy(
    {},
    {
      get(_, id: string) {
        return new Proxy<ClientManifest>(
          {},
          {
            get(_, name) {
              return {
                id,
                name,
                chunks: [],
              };
            },
          },
        );
      },
    },
  );
