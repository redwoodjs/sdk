'use client'

import { deleteTodo } from "../pages/actions"

export function Delete({ id }: { id: string }) {
    return (
        <button onClick={() => deleteTodo(id)}>Delete</button>
    )
}