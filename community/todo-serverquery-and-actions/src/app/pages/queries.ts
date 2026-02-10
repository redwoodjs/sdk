"use server";

import { serverQuery } from "rwsdk/worker";
import { db } from "@/db";

export const getTodos = serverQuery(async () => {
  return await db.selectFrom("todos").selectAll().execute();
});