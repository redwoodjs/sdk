"use server";

import { db } from "@/db/db";

export async function addTodo(text: string) {
  if (!text) {
    return;
  }

  await db
    .insertInto("todos")
    .values({
      id: crypto.randomUUID(),
      text,
      completed: 0,
      createdAt: new Date().toISOString(),
    })
    .execute();
}

export async function toggleTodo(id: string, completed: boolean) {
  await db
    .updateTable("todos")
    .set({ completed: completed ? 1 : 0 })
    .where("id", "=", id)
    .execute();
}
