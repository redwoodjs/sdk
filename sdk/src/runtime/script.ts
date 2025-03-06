export const defineScript = (
  fn: ({ env }: { env: Env }) => Promise<unknown>,
) => {
  return {
    async fetch(request: Request, env: Env) {
      await fn({ env });
      return new Response("Done!");
    },
  };
};
