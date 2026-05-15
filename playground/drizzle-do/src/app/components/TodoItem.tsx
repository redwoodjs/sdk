"use client";

import { toggleTodo } from "@/app/actions";
import { useTransition } from "react";

export function TodoItem({
  todo,
}: {
  todo: { id: string; text: string; completed: boolean };
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`todo-item ${todo.completed ? "completed" : ""}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() =>
          startTransition(() => toggleTodo(todo.id, !todo.completed))
        }
        disabled={isPending}
      />
      <span>{todo.text}</span>
    </div>
  );
}
