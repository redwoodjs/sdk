"use server";

import { serverQuery } from "rwsdk/worker";

export const getGreetingReExported = serverQuery(async (name: string) => {
  return `Hello, ${name}! (from serverQuery re-export)`;
});
