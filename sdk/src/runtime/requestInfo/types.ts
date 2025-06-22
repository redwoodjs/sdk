import { RwContext } from "../lib/router";

export interface DefaultAppContext {}

export interface RequestInfo<Params = any, AppContext = DefaultAppContext> {
  request: Request;
  params: Params;
  ctx: AppContext;
  headers: Headers;
  rw: RwContext;
  cf: ExecutionContext;
}
