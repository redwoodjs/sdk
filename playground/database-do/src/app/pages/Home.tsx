import { addTodoAction } from "@/app/actions";
import { SubmitButton } from "@/app/components/SubmitButton";
import { TodoItem } from "@/app/components/TodoItem";
import { db } from "@/db/db";

async function getTodos() {
  return await db
    .selectFrom("todos")
    .selectAll()
    .orderBy("createdAt", "asc")
    .execute();
}

export async function Home() {
  const todos = await getTodos();

  return (
    <div className="container">
      <h1>Todo List</h1>
      <form action={addTodoAction}>
        <input type="text" name="text" placeholder="Add a new todo" required />
        <SubmitButton />
      </form>
      <div className="todo-list">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
        {todos.length === 0 && <p>No todos yet. Add one above!</p>}
      </div>
    </div>
  );
}
