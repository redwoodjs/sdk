"use server";

import { requestInfo } from "rwsdk/worker";

export async function doServerAction() {
  const { response } = requestInfo;
  response.headers.set("X-Server-Action-Success", "true");
  return "Server action result";
}
