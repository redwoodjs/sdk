'use client'

import { useOptimistic, startTransition } from "react"
import { Todo } from "./Todo"
import { deleteTodo } from "../pages/actions"
import type { Todo as TodoType } from "@/db"

export function TodoList({ initialTodos }: { initialTodos: TodoType[] }) {
    const [optimisticTodos, removeOptimisticTodo] = useOptimistic<TodoType[], string>(
        initialTodos,
        (state, idToRemove) => state.filter(todo => todo.id !== idToRemove)
    )

    const handleDelete = async (id: string) => {
        startTransition(async () => {
            removeOptimisticTodo(id)
            await deleteTodo(id)
        })
    }

    return (
        <ul className="divide-y divide-slate-100/50">
            {optimisticTodos.map((todo) => (
                <Todo key={todo.id} todo={todo} onDelete={() => handleDelete(todo.id)} />
            ))}
        </ul>
    )
}
