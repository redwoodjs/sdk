"use server";

import { serverAction } from "rwsdk/worker";
import { db } from "@/db";

export const createTodo = serverAction(async (formData: FormData) => {
  const text = formData.get("text");
  if (!text) {
    return;
  }
  await db.insertInto("todos").values({
    id: crypto.randomUUID(),
    text: text as string,
    completed: 0,
    createdAt: new Date().toISOString()
  }).execute();
});

export const clearTodos = serverAction(async () => {
  await db.deleteFrom("todos").execute();
});

export const deleteTodo = serverAction(async (id: string) => {
  await db.deleteFrom("todos").where("id", "=", id).execute();
});

export const updateTodo = serverAction(async (id: string, completed: number) => {
  await db.updateTable("todos").set({ completed }).where("id", "=", id).execute();
  const todo = await db.selectFrom("todos").selectAll().where("id", "=", id).executeTakeFirst();  
  return todo
});

export const editTodo = serverAction(async (id: string, text: string) => {
  await db.updateTable("todos").set({ text }).where("id", "=", id).execute();
  const todo = await db.selectFrom("todos").selectAll().where("id", "=", id).executeTakeFirst();
  return todo
});
