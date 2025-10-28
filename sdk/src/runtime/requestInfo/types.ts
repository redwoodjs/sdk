import { RwContext } from "../lib/types.js";

export interface DefaultAppContext {}

// NOTE: (peterp, 2025-08-01):
// I think we should rename this to something other than request-info.
// Since it's both the request and the response.
// HttpMessages?
export interface RequestInfo<Params = any, AppContext = DefaultAppContext> {
  request: Request;
  params: Params;
  ctx: AppContext;
  rw: RwContext;
  cf: ExecutionContext;
  // context(justinvdm, 2025-08-18): Ensure headers is always available
  response: ResponseInit & { headers: Headers };
  isAction: boolean;
}

export type PartialRequestInfo<
  Params = any,
  AppContext = DefaultAppContext,
> = Omit<Partial<RequestInfo<Params, AppContext>>, "rw"> & {
  rw?: Partial<RwContext>;
};
