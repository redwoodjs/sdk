import { getTodos } from "../pages/queries";
import { TodoList } from "./TodoList";

export async function TodoListFetch() {
    const todos = await getTodos();

    if (todos.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-slate-400 italic">No tasks yet. Enjoy your day! ☀️</p>
            </div>
        );
    }

    return <TodoList initialTodos={todos} />;
}
