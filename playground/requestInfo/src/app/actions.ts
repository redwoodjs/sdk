"use server";

import { requestInfo } from "rwsdk/worker";

export async function setHeadersAction() {
  const { response } = requestInfo;
  response.headers.set("X-Server-Action", "true");
}
