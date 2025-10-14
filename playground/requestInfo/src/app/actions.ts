"use server";

import { serverDep } from "server-lib";

export async function doServerAction() {
  return serverDep();
}
