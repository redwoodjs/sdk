"use server";

import { serverAction, serverQuery } from "rwsdk/worker";

export const getProofGreeting = serverQuery(async (name: string) => {
  return `Hello, ${name}! (serverQuery preserved)`;
});

export const updateProofName = serverAction(async (name: string) => {
  return `Updated ${name} (serverAction preserved)`;
});
