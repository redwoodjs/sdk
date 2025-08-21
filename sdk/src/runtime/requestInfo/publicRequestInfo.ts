import { RequestInfo } from "./types";

export type PublicRequestInfo = {
  ctx: RequestInfo["ctx"];
  params: RequestInfo["params"];
};

// context(justinvdm, 21 aug 2025): We only want to pass some of the requestInfo
// to the client - for safety and since some request info is not serializable.
export const getPublicRequestInfo = (requestInfo: RequestInfo) => {
  const {
    request: _request,
    headers: _headers,
    rw: _rw,
    cf: _cf,
    response: _response,
    ...rest
  } = requestInfo;
  return rest;
};
