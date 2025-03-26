export type RouteOptions<TParams = Record<string, string>> = {
  request: Request;
  params: TParams;
  env: Env;
  user: {
    id: string;
    // Add other user properties as needed
  };
};
