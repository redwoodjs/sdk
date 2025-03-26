"use server";

import { sessions } from "@/session/store";
import { RouteOptions } from "@redwoodjs/sdk/router";

export async function performLogin(ctx?: RouteOptions) {
  const { headers } = ctx!;

  // >>> Authentication logic for user goes here
  // >>> Replace this stub: e.g. get the user id from your database
  const userId = crypto.randomUUID();

  // >>> Once the user is authenticated, we need to create a session for them.
  return sessions.save(headers, { userId });
}
