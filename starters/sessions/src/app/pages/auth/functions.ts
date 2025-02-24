"use server";

import { sessions } from "@/session/store";

export async function performLogin() {
  // >>> Authentication logic for user goes here
  // >>> Replace this stub: e.g. get the user id from your database
  const userId = crypto.randomUUID();

  // >>> Once the user is authenticated, we need to create a session for them.
  const response = new Response(null);

  return sessions.save(response, { userId });
}