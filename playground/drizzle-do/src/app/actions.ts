"use server";

import { getDb } from "@/db/db";

export async function addTodo(text: string) {
  if (!text) {
    return;
  }

  const db = getDb();
  await db.insertTodo({
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  });
}

export async function addTodoAction(formData: FormData) {
  const text = formData.get("text") as string;
  await addTodo(text);
}

export async function toggleTodo(id: string, completed: boolean) {
  const db = getDb();
  await db.toggleTodo(id, completed);
}
